#!/usr/bin/env python3
"""
scripts/ccmas/extract_ccmas.py

Step 1 of the CCMAS pipeline:  PDF  ->  JSON  ->  (validate + import) -> DB.

Reads the NUC CCMAS PDF (default: src/lib/resources/Engineering-CCMAS.pdf)
and writes a structured JSON file (default:
src/lib/resources/ccmas/Engineering-CCMAS.json). Nothing in the app reads
that JSON at runtime — scripts/ccmas/import-ccmas.ts loads it into the
CCMAS* tables and the database is the runtime source of truth.

Only what the document actually says is extracted. In particular the
course-structure tables list courses per LEVEL and do not state a semester,
so `semester` is null everywhere rather than inferred.

Usage:
  python3 scripts/ccmas/extract_ccmas.py [pdf] [out.json] [--pages-cache pages.json]

Requires: pip install pdfplumber
"""
import json
import re
import sys
import hashlib
from datetime import datetime, timezone

DEFAULT_PDF = "src/lib/resources/Engineering-CCMAS.pdf"
DEFAULT_OUT = "src/lib/resources/ccmas/Engineering-CCMAS.json"

# Glossary of Course Codes, Category C (PDF p.23): programme -> course prefix.
# Read from the document; used only to label programmes with the code the
# document itself assigns.
PROGRAMME_CODES = {
    "Aerospace Engineering": "AAE",
    "Agricultural and Biosystems Engineering": "ABE",
    "Automotive Engineering": "TAE",
    "Biomedical Engineering": "BME",
    "Chemical Engineering": "TCH",
    "Civil Engineering": "CEE",
    "Computer Engineering": "CPE",
    "Electrical Engineering": "TEL",
    "Electrical and Electronics Engineering": "EEE",
    "Electronics Engineering": "ELE",
    "Environmental Engineering": "EVE",
    "Food Science and Technology": "FST",
    "Industrial and Production Engineering": "IPE",
    "Information and Communication Engineering": "ICE",
    "Marine Engineering": "MAR",
    "Materials and Metallurgical Engineering": "MME",
    "Mechanical Engineering": "MEE",
    "Mechatronic Engineering": "MCE",
    "Metallurgical Engineering": "MTE",
    "Mining Engineering": "MNE",
    "Natural Gas Engineering": "GNG",
    "Petrochemical Engineering": "PCE",
    "Petroleum and Gas Engineering": "PGE",
    "Petroleum Engineering": "PEE",
    "Structural Engineering": "STE",
    "Systems Engineering": "SYE",
}

ROW_START = re.compile(r"^([A-Z]{3}) ?(\d{3}) (.+)$")
# tail of a structure row:  <title> <units> <status> [LH] [PH]
ROW_TAIL = re.compile(r"^(.*?)\s+(\d+)\s+([CERO])(?:\s+(.*))?$")
DETAIL_HEAD = re.compile(
    r"^([A-Z]{3}) ?(\d{3}):\s*(.+?)\s*\((\d+)\s*Units?\s*([A-Z])?\s*:?\s*(.*?)\)\s*$"
)
DETAIL_START = re.compile(r"^[A-Z]{3} ?\d{3}:\s")
LEVEL_HEAD = re.compile(r"^(\d{3}) Level$", re.I)
SEM_HEAD = re.compile(r"^(First|Second|Alpha|Omega|1st|2nd)\s+Semester", re.I)
TOC_LINE = re.compile(r"^(B\.?\s?(?:Eng|Sc|Tech)\.?)\s*(.+?)\s*\.{3,}\s*(\d+)\s*$", re.M)

STATUS = {"C": "CORE", "E": "ELECTIVE", "R": "REQUIRED", "O": "OPTIONAL"}


def hours(token):
    """'45' -> 45, '-' or missing -> None, anything else kept as text."""
    if token is None:
        return None
    token = token.strip()
    if token in ("", "-"):
        return None
    return int(token) if token.isdigit() else token


def parse_hours(rest):
    """rest = remaining text after the status letter: 'LH PH'."""
    if not rest:
        return None, None
    toks = rest.split()
    if len(toks) >= 2 and re.match(r"^[Ww]eeks?$", toks[1]):
        # e.g. '24 Weeks'  -> duration text, not LH/PH
        return {"duration": f"{toks[0]} {toks[1]}"}, None
    lh = hours(toks[0]) if len(toks) > 0 else None
    ph = hours(toks[1]) if len(toks) > 1 else None
    return lh, ph


# The PDF prints some Latin letters as Cyrillic lookalikes (e.g. the status
# "С" in "GET 201 … 3 С 45"), which silently breaks row matching.
CYRILLIC_TO_LATIN = str.maketrans("СЕОРАВНКМТХсеорахк", "CEOPABHKMTXceopaxk")


def clean_lines(text, page_no):
    out = []
    for ln in (text or "").translate(CYRILLIC_TO_LATIN).split("\n"):
        ln = ln.strip()
        if not ln or ln == str(page_no):  # drop running page-number footers
            continue
        out.append(ln)
    return out


def parse_structure(lines_with_page):
    """Course-structure tables -> list of programme-course rows."""
    rows, level, semester, last = [], None, None, None
    for page, ln in lines_with_page:
        m = LEVEL_HEAD.match(ln)
        if m:
            level, semester, last = int(m.group(1)), None, None
            continue
        if SEM_HEAD.match(ln):
            semester, last = SEM_HEAD.match(ln).group(1), None
            continue
        if ln.startswith(("Course Code", "Course Course", "Total", "SIWES Courses", "*")):
            last = None
            continue
        if ln in ("Code", "-"):  # wrapped header cell / wrapped empty PH cell
            continue
        m = ROW_START.match(ln)
        if m and level is not None:
            t = ROW_TAIL.match(m.group(3))
            if t:
                lh, ph = parse_hours(t.group(4))
                dur = None
                if isinstance(lh, dict):
                    dur, lh = lh["duration"], None
                last = {
                    "code": f"{m.group(1)} {m.group(2)}",
                    "title": t.group(1).strip(),
                    "creditUnits": int(t.group(2)),
                    "courseType": STATUS[t.group(3)],
                    "statusLetter": t.group(3),
                    "level": level,
                    "semester": semester,
                    "lectureHours": lh,
                    "practicalHours": ph,
                    "duration": dur,
                    "sourcePage": page,
                }
                rows.append(last)
                continue
        # wrapped title continuation of the previous row
        if last is not None and not m and len(ln) < 80 and not re.search(r"\d+ [CER]\b", ln):
            last["title"] += " " + ln
        else:
            last = None
    return rows


def parse_details(lines_with_page):
    """'Course Contents and Learning Outcomes' -> {code: detail}."""
    details, cur, mode = {}, None, None
    level_cur = None  # the "NNN Level" heading the contents section is currently under
    i, n = 0, len(lines_with_page)
    while i < n:
        page, ln = lines_with_page[i]
        if LEVEL_HEAD.match(ln):
            level_cur = int(LEVEL_HEAD.match(ln).group(1))
            cur, mode = None, None
            i += 1
            continue
        if DETAIL_START.match(ln):
            head = ln
            # title may wrap before the '(N Units ...)' part
            while not re.search(r"\(\d+\s*Units?", head) and i + 1 < n and len(head) < 200:
                i += 1
                head += " " + lines_with_page[i][1]
            m = DETAIL_HEAD.match(head)
            if m:
                cur = {
                    "code": f"{m.group(1)} {m.group(2)}",
                    "title": m.group(3).strip(),
                    "creditUnits": int(m.group(4)),
                    "statusLetter": m.group(5),
                    "hoursText": m.group(6) or None,
                    "learningOutcomes": [],
                    "courseContents": [],
                    "prerequisites": None,
                    "sourcePage": page,
                    "level": level_cur,
                }
                lh = re.search(r"LH\s*(\d+)", m.group(6) or "")
                ph = re.search(r"PH\s*(\d+)", m.group(6) or "")
                cur["lectureHours"] = int(lh.group(1)) if lh else None
                cur["practicalHours"] = int(ph.group(1)) if ph else None
                details.setdefault(cur["code"], cur)  # first occurrence wins
                if details[cur["code"]] is not cur:
                    cur = None  # duplicate heading inside one programme: ignore body
                mode = None
            i += 1
            continue
        if cur is not None:
            if ln.startswith("Learning Outcomes"):
                mode = "lo"
            elif ln.startswith("Course Contents"):
                mode = "cc"
            elif re.match(r"^(Pre-?requisites?)\b", ln, re.I):
                cur["prerequisites"] = re.sub(r"^Pre-?requisites?:?\s*", "", ln, flags=re.I) or None
            elif ln.startswith("Minimum Academic Standards"):
                cur = None
            elif mode == "lo":
                if re.match(r"^\d+\.\s", ln) or not cur["learningOutcomes"]:
                    if not re.match(r"^(At the (end|completion)|The student|Upon|By the end)", ln, re.I):
                        cur["learningOutcomes"].append(ln)
                else:
                    cur["learningOutcomes"][-1] += " " + ln
            elif mode == "cc":
                cur["courseContents"].append(ln)
        i += 1
    for d in details.values():
        d["courseContents"] = " ".join(d["courseContents"]).strip() or None
        d["learningOutcomes"] = [re.sub(r"^\d+\.\s*", "", x) for x in d["learningOutcomes"]]
    return details


def section(lines, start_pat, end_pats):
    out, on = [], False
    for ln in lines:
        if not on and re.match(start_pat, ln):
            on = True
            continue
        if on and any(re.match(p, ln) for p in end_pats):
            break
        if on:
            out.append(ln)
    text = " ".join(out).strip()
    return text or None


def parse(pages, source_name):
    toc_text = "\n".join(pages[12:19])
    starts = []
    for m in TOC_LINE.finditer(toc_text):
        starts.append((int(m.group(3)), m.group(1).replace(" ", "").replace("B.", "B."), m.group(2).strip()))
    starts.sort()
    programmes = []
    warnings = []
    for idx, (start, degree, name) in enumerate(starts):
        end = starts[idx + 1][0] - 1 if idx + 1 < len(starts) else len(pages)
        # page N printed == pdf page N (verified on the 1101-page edition)
        lines = []
        for p in range(start, end + 1):
            for ln in clean_lines(pages[p - 1], p):
                lines.append((p, ln))
        flat = [l for _, l in lines]

        try:
            s_idx = next(i for i, (_, l) in enumerate(lines) if l == "Global Course Structure" and i > 40)
        except StopIteration:
            s_idx = next((i for i, (_, l) in enumerate(lines) if l == "Global Course Structure"), None)
        c_idx = next((i for i, (_, l) in enumerate(lines) if l.startswith("Course Contents and Learning Outco")), None)
        if s_idx is None or c_idx is None:
            warnings.append(f"{name}: could not locate structure/contents sections (start={s_idx}, contents={c_idx})")
            continue

        rows = parse_structure(lines[s_idx:c_idx])
        details = parse_details(lines[c_idx:])

        seen, courses = set(), []
        for r in rows:
            key = (r["code"], r["level"])
            if key in seen:
                warnings.append(f"{name}: duplicate structure row {r['code']} @ level {r['level']} (kept first)")
                continue
            seen.add(key)
            digit = int(r["code"].split()[1][0]) * 100
            if digit != r["level"] and r["code"].split()[0] != "GET" or (r["code"].startswith("GET") and digit != r["level"] and r["code"][4] not in "0"):
                warnings.append(
                    f"{name}: {r['code']} sits under the '{r['level']} Level' heading (p.{r['sourcePage']}) but its number implies {digit}; heading kept, source likely omits a level heading"
                )
            d = details.get(r["code"])
            r["description"] = d["courseContents"] if d else None
            r["learningOutcomes"] = d["learningOutcomes"] if d else []
            r["prerequisites"] = d["prerequisites"] if d else None
            r["detailPage"] = d["sourcePage"] if d else None
            if d and d["creditUnits"] != r["creditUnits"]:
                warnings.append(
                    f"{name}: {r['code']} units differ (structure {r['creditUnits']} vs detail {d['creditUnits']})"
                )
            if d and d["lectureHours"] is not None and r["lectureHours"] is None:
                r["lectureHours"] = d["lectureHours"]
            if d and d["practicalHours"] is not None and r["practicalHours"] is None:
                r["practicalHours"] = d["practicalHours"]
            courses.append(r)

        # Courses the contents section describes (under a printed level heading) but the
        # level table never listed: promote them, flagged, so nothing the document
        # defines is lost. Level and every value come from the document itself.
        listed = {c["code"] for c in courses}
        for code, d in details.items():
            if code in listed or d.get("level") is None or d["statusLetter"] not in STATUS:
                continue
            weeks = re.search(r"(\d+)\s*weeks?", d["hoursText"] or "", re.I)
            courses.append({
                "code": code, "title": d["title"], "creditUnits": d["creditUnits"], "courseType": STATUS[d["statusLetter"]],
                "statusLetter": d["statusLetter"], "level": d["level"], "semester": None,
                "lectureHours": d["lectureHours"], "practicalHours": d["practicalHours"],
                "duration": f"{weeks.group(1)} weeks" if weeks else None, "sourcePage": d["sourcePage"],
                "description": d["courseContents"], "learningOutcomes": d["learningOutcomes"], "prerequisites": d["prerequisites"],
                "detailPage": d["sourcePage"], "origin": "detail-only",
            })
            warnings.append(f"{name}: {code} is described under '{d['level']} Level' (p.{d['sourcePage']}) but not listed in the level table; added from the course description")
            listed.add(code)
        orphans = [c for c in details if c not in listed]

        head = flat[: s_idx]
        stop = [r"^(Philosophy|Objectives|Unique Features|Employability|21st|Admission|Global Course)"]
        min_units = re.search(r"at least (\d+) units", " ".join(flat[s_idx - 40 : s_idx]))
        programmes.append(
            {
                "name": name,
                "degree": degree,
                "code": PROGRAMME_CODES.get(name),
                "sourcePages": {"start": start, "end": end},
                "overview": section(head, r"^Overview$", [r"^(Philosophy|Philisophy|Objectives)"]),
                "philosophy": section(head, r"^Phil[io]sophy$", [r"^(Objectives|Unique Features|Employability)"]),
                "objectives": section(head, r"^Objectives$", [r"^(Unique Features|Employability|21st)"]),
                "minimumCreditUnits": int(min_units.group(1)) if min_units else None,
                "courses": courses,
                "unlistedCourseDetails": [
                    {k: v for k, v in details[c].items() if k != "statusLetter"} for c in orphans
                ],
            }
        )
    return programmes, warnings


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    cache = None
    if "--pages-cache" in sys.argv:
        cache = sys.argv[sys.argv.index("--pages-cache") + 1]
        args = [a for a in args if a != cache]
    pdf = args[0] if len(args) > 0 else DEFAULT_PDF
    out = args[1] if len(args) > 1 else DEFAULT_OUT

    if cache:
        pages = json.load(open(cache))
    else:
        import pdfplumber

        with pdfplumber.open(pdf) as doc:
            pages = [(p.extract_text() or "") for p in doc.pages]

    programmes, warnings = parse(pages, pdf)
    sha = hashlib.sha256(open(pdf, "rb").read()).hexdigest()
    doc = {
        "source": {
            "name": "NUC/CCMAS",
            "title": "Core Curriculum and Minimum Academic Standards (CCMAS) for Nigerian Universities — Engineering and Technology",
            "document": pdf.split("/")[-1],
            "version": "2021",
            "sha256": sha,
            "pageCount": len(pages),
            "extractedAt": datetime.now(timezone.utc).isoformat(),
        },
        "disciplines": [{"name": "Engineering and Technology", "programmes": programmes}],
        "warnings": warnings,
    }
    import os

    os.makedirs(os.path.dirname(out), exist_ok=True)
    json.dump(doc, open(out, "w"), indent=1, ensure_ascii=False)
    n_courses = sum(len(p["courses"]) for p in programmes)
    print(f"programmes={len(programmes)} programmeCourses={n_courses} warnings={len(warnings)} -> {out}")


if __name__ == "__main__":
    main()
