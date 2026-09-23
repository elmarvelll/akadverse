import { isAdminEmail } from "../src/lib/admin-identity";
let f = 0;
const t = (email: unknown, want: boolean) => { const got = isAdminEmail(email as string); if (got !== want) f++; console.log(`${got === want ? "PASS" : "FAIL"}  ${JSON.stringify(email)} -> ${got}`); };
// must match (exact local-part, any domain, any case)
t("marvelousifezue31@gmail.com", true);
t("marvelousifezue31@outlook.com", true);
t("marvelousifezue31@any-valid-domain.com", true);
t("MarvelousIfezue31@Example.COM", true);
t("  marvelousifezue31@stu.cu.edu.ng ", true);
t("marvelousifezue31@dapu.cu.edu.ng", true);
// must NOT match
t("not-marvelousifezue31@gmail.com", false);
t("marvelousifezue31x@gmail.com", false);
t("xmarvelousifezue31@gmail.com", false);
t("marvelousifezue31+tag@gmail.com", false);
t("marvelousifezue3@gmail.com", false);
t("someone@marvelousifezue31.com", false);
t("marvelousifezue31", false);
t("marvelousifezue31@", false);
t("@gmail.com", false);
t("", false); t(null, false); t(undefined, false); t(42, false);
console.log(f ? `\n${f} FAILED` : "\nall passed"); process.exit(f ? 1 : 0);
