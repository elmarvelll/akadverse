# CCMAS 2023 source review

Status: reference edition staged and field-verified; operational activation/reset pending final review. Course-table credit units take precedence by user decision; discrepancies remain visible to DAPU.

Source SHA256: `99030f5f3c5593246ec80178a2a84e562da384173ddc5be71e08d1bfb3e943fe`; 1332 pages.

34 programmes; 1,802 programme-course placements; 282 warnings requiring review. These counts do not establish that every extracted row is correct.

The source uses “Electrical and Electronic Engineering” while the existing institution uses Electrical and Electronics Engineering. Map the new EEE reference to the existing Programme ID; preserve its name, EIENG department and identity relationships.

## Programmes

| Source programme | Source code | Extracted rows | PDF pages |
| --- | --- | ---: | --- |
| Aerospace Engineering | AAE | 53 | 35–74 |
| Agricultural and Biosystems Engineering | ABE | 53 | 75–119 |
| Automotive Engineering | TAE | 51 | 120–154 |
| Biomedical Engineering | BME | 55 | 155–197 |
| Chemical Engineering | TCH | 53 | 198–231 |
| Civil Engineering | CEE | 53 | 232–268 |
| Computer Engineering | CPE | 59 | 269–308 |
| Electrical Engineering | TEL | 52 | 309–349 |
| Electronic Engineering | ELE | 51 | 350–385 |
| Electrical and Electronic Engineering | EEE | 50 | 386–417 |
| Environmental Engineering | EVE | 53 | 418–452 |
| Food Engineering | FDE | 44 | 453–498 |
| Food Science and Technology | FST | 58 | 499–538 |
| Information and Communication Engineering | ICE | 56 | 539–574 |
| Industrial and Production Engineering | IPE | 49 | 575–610 |
| Marine and Offshore Engineering | MAR | 64 | 611–655 |
| Materials and Metallurgical Engineering | MME | 54 | 656–691 |
| Mineral Processing and Chemical Metallurgical Engineering | MPE | 43 | 692–734 |
| Mechanical Engineering | MEE | 55 | 735–772 |
| Mechatronics Engineering | MCE | 54 | 773–810 |
| Metallurgical Engineering | MTE | 63 | 811–854 |
| Materials Engineering | MSE | 51 | 855–890 |
| Mining Engineering | MNE | 50 | 891–931 |
| Natural Gas Engineering | GNG | 50 | 932–966 |
| Nuclear Engineering | NUE | 58 | 967–1003 |
| Petrochemical Engineering | PCE | 57 | 1004–1043 |
| Petroleum and Gas Engineering | PGE | 52 | 1044–1081 |
| Petroleum Engineering | PEE | 53 | 1082–1117 |
| Railway Engineering | RWE | 54 | 1118–1157 |
| Structural Engineering | STE | 49 | 1158–1194 |
| Systems Engineering | SYE | 51 | 1195–1228 |
| Telecommunications Engineering | TEE | 52 | 1229–1265 |
| Water Resources Engineering | WRE | 51 | 1266–1298 |
| Wood Products Engineering | WPE | 51 | 1299–1332 |

## Source conflicts and extraction warnings

Do not resolve discrepancies by changing DAPU business logic or inferring semesters from code numbers. For example, PDF pages 391–392 explicitly credit SIWES in the second semester of 400 level despite 299/399 course numbers. Preserve this evidence for DAPU review.

- Aerospace Engineering: AAE 101 units differ (structure 2 vs detail 1)
- Aerospace Engineering: GET 299 sits under the '400 Level' heading (p.39) but its number implies 200; heading kept, source likely omits a level heading
- Aerospace Engineering: GET 399 sits under the '400 Level' heading (p.39) but its number implies 300; heading kept, source likely omits a level heading
- Aerospace Engineering: duplicate structure row GET 404 @ level 400 (kept first)
- Aerospace Engineering: AAE 501 units differ (structure 2 vs detail 3)
- Agricultural and Biosystems Engineering: GET 299 sits under the '400 Level' heading (p.80) but its number implies 200; heading kept, source likely omits a level heading
- Agricultural and Biosystems Engineering: GET 399 sits under the '400 Level' heading (p.80) but its number implies 300; heading kept, source likely omits a level heading
- Agricultural and Biosystems Engineering: duplicate structure row GET 404 @ level 400 (kept first)
- Agricultural and Biosystems Engineering: ABE 599 units differ (structure 4 vs detail 3)
- Automotive Engineering: GET 299 sits under the '400 Level' heading (p.124) but its number implies 200; heading kept, source likely omits a level heading
- Automotive Engineering: GET 399 sits under the '400 Level' heading (p.124) but its number implies 300; heading kept, source likely omits a level heading
- Automotive Engineering: duplicate structure row GET 404 @ level 400 (kept first)
- Automotive Engineering: TAE 505 units differ (structure 2 vs detail 3)
- Automotive Engineering: TAE 506 is described under '500 Level' (p.148) but not listed in the level table; added from the course description
- Biomedical Engineering: BIO 101 units differ (structure 2 vs detail 3)
- Biomedical Engineering: GET 299 sits under the '400 Level' heading (p.160) but its number implies 200; heading kept, source likely omits a level heading
- Biomedical Engineering: GET 399 sits under the '400 Level' heading (p.160) but its number implies 300; heading kept, source likely omits a level heading
- Biomedical Engineering: GET 499 units differ (structure 4 vs detail 8)
- Biomedical Engineering: duplicate structure row GET 404 @ level 400 (kept first)
- Biomedical Engineering: GST 111 is described under '100 Level' (p.161) but not listed in the level table; added from the course description
- Biomedical Engineering: MTH 103 is described under '100 Level' (p.165) but not listed in the level table; added from the course description
- Biomedical Engineering: BME 321 is described under '300 Level' (p.181) but not listed in the level table; added from the course description
- Chemical Engineering: GET 307 units differ (structure 2 vs detail 3)
- Chemical Engineering: GET 299 sits under the '400 Level' heading (p.203) but its number implies 200; heading kept, source likely omits a level heading
- Chemical Engineering: GET 399 sits under the '400 Level' heading (p.203) but its number implies 300; heading kept, source likely omits a level heading
- Chemical Engineering: GET 499 units differ (structure 4 vs detail 8)
- Chemical Engineering: duplicate structure row GET 404 @ level 400 (kept first)
- Chemical Engineering: MTH 103 is described under '100 Level' (p.208) but not listed in the level table; added from the course description
- Civil Engineering: CEE 101 units differ (structure 2 vs detail 1)
- Civil Engineering: GST 212 sits under the '100 Level' heading (p.236) but its number implies 200; heading kept, source likely omits a level heading
- Civil Engineering: ENT 211 sits under the '100 Level' heading (p.236) but its number implies 200; heading kept, source likely omits a level heading
- Civil Engineering: GET 201 sits under the '100 Level' heading (p.236) but its number implies 200; heading kept, source likely omits a level heading
- Civil Engineering: GET 202 sits under the '100 Level' heading (p.236) but its number implies 200; heading kept, source likely omits a level heading
- Civil Engineering: GET 204 sits under the '100 Level' heading (p.236) but its number implies 200; heading kept, source likely omits a level heading
- Civil Engineering: GET 205 sits under the '100 Level' heading (p.236) but its number implies 200; heading kept, source likely omits a level heading
- Civil Engineering: GET 206 sits under the '100 Level' heading (p.236) but its number implies 200; heading kept, source likely omits a level heading
- Civil Engineering: GET 208 sits under the '100 Level' heading (p.236) but its number implies 200; heading kept, source likely omits a level heading
- Civil Engineering: GET 209 sits under the '100 Level' heading (p.236) but its number implies 200; heading kept, source likely omits a level heading
- Civil Engineering: GET 210 sits under the '100 Level' heading (p.236) but its number implies 200; heading kept, source likely omits a level heading
- Civil Engineering: GET 211 sits under the '100 Level' heading (p.236) but its number implies 200; heading kept, source likely omits a level heading
- Civil Engineering: CEE 201 sits under the '100 Level' heading (p.236) but its number implies 200; heading kept, source likely omits a level heading
- Civil Engineering: GET 299 sits under the '400 Level' heading (p.237) but its number implies 200; heading kept, source likely omits a level heading
- Civil Engineering: GET 399 sits under the '400 Level' heading (p.237) but its number implies 300; heading kept, source likely omits a level heading
- Civil Engineering: GET 499 units differ (structure 4 vs detail 8)
- Civil Engineering: duplicate structure row GET 404 @ level 400 (kept first)
- Civil Engineering: CEE 302 is described under '300 Level' (p.258) but not listed in the level table; added from the course description
- Civil Engineering: CEE 305 is described under '300 Level' (p.259) but not listed in the level table; added from the course description
- Civil Engineering: CEE 306 is described under '300 Level' (p.259) but not listed in the level table; added from the course description
- Civil Engineering: CEE 307 is described under '300 Level' (p.259) but not listed in the level table; added from the course description
- Civil Engineering: CEE 406 is described under '400 Level' (p.261) but not listed in the level table; added from the course description
- Computer Engineering: CPE 301 units differ (structure 2 vs detail 3)
- Computer Engineering: EEE 321 units differ (structure 2 vs detail 3)
- Computer Engineering: GET 299 sits under the '400 Level' heading (p.275) but its number implies 200; heading kept, source likely omits a level heading
- Computer Engineering: GET 399 sits under the '400 Level' heading (p.275) but its number implies 300; heading kept, source likely omits a level heading
- Computer Engineering: GET 499 units differ (structure 4 vs detail 8)
- Computer Engineering: duplicate structure row GET 404 @ level 400 (kept first)
- Computer Engineering: CHM 101 is described under '100 Level' (p.277) but not listed in the level table; added from the course description
- Computer Engineering: CHM 102 is described under '100 Level' (p.277) but not listed in the level table; added from the course description
- Computer Engineering: CHM 107 is described under '100 Level' (p.278) but not listed in the level table; added from the course description
- Computer Engineering: CHM 108 is described under '100 Level' (p.278) but not listed in the level table; added from the course description
- Computer Engineering: CPE 112 is described under '100 Level' (p.282) but not listed in the level table; added from the course description
- Computer Engineering: ENT 211 is described under '200 Level' (p.282) but not listed in the level table; added from the course description
- Computer Engineering: CET 202 is described under '200 Level' (p.283) but not listed in the level table; added from the course description
- Computer Engineering: CPE 307 is described under '300 Level' (p.294) but not listed in the level table; added from the course description
- Computer Engineering: CET 599 is described under '500 Level' (p.302) but not listed in the level table; added from the course description
- Electrical Engineering: GET 203 units differ (structure 2 vs detail 3)
- Electrical Engineering: GET 299 sits under the '400 Level' heading (p.314) but its number implies 200; heading kept, source likely omits a level heading
- Electrical Engineering: GET 399 sits under the '400 Level' heading (p.314) but its number implies 300; heading kept, source likely omits a level heading
- Electrical Engineering: GET 399 units differ (structure 4 vs detail 3)
- Electrical Engineering: GET 499 units differ (structure 4 vs detail 8)
- Electrical Engineering: TEL 102 is described under '100 Level' (p.320) but not listed in the level table; added from the course description
- Electronic Engineering: GET 203 units differ (structure 2 vs detail 3)
- Electronic Engineering: GET 299 sits under the '400 Level' heading (p.354) but its number implies 200; heading kept, source likely omits a level heading
- Electronic Engineering: GET 399 sits under the '400 Level' heading (p.354) but its number implies 300; heading kept, source likely omits a level heading
- Electronic Engineering: GET 399 units differ (structure 4 vs detail 3)
- Electronic Engineering: GET 499 units differ (structure 4 vs detail 8)
- Electronic Engineering: duplicate structure row GET 404 @ level 400 (kept first)
- Electronic Engineering: ELE 505 is described under '500 Level' (p.379) but not listed in the level table; added from the course description
- Electrical and Electronic Engineering: CHM 101 units differ (structure 3 vs detail 2)
- Electrical and Electronic Engineering: GET 203 units differ (structure 2 vs detail 3)
- Electrical and Electronic Engineering: GET 299 sits under the '400 Level' heading (p.391) but its number implies 200; heading kept, source likely omits a level heading
- Electrical and Electronic Engineering: GET 399 sits under the '400 Level' heading (p.392) but its number implies 300; heading kept, source likely omits a level heading
- Electrical and Electronic Engineering: duplicate structure row GET 499 @ level 400 (kept first)
- Electrical and Electronic Engineering: duplicate structure row GET 404 @ level 400 (kept first)
- Environmental Engineering: GET 299 sits under the '400 Level' heading (p.423) but its number implies 200; heading kept, source likely omits a level heading
- Environmental Engineering: GET 399 sits under the '400 Level' heading (p.423) but its number implies 300; heading kept, source likely omits a level heading
- Environmental Engineering: GET 399 units differ (structure 4 vs detail 3)
- Environmental Engineering: duplicate structure row GET 499 @ level 400 (kept first)
- Environmental Engineering: duplicate structure row GET 404 @ level 400 (kept first)
- Environmental Engineering: GET 205 is described under '200 Level' (p.433) but not listed in the level table; added from the course description
- Environmental Engineering: EVE 201 is described under '200 Level' (p.436) but not listed in the level table; added from the course description
- Food Engineering: FDE 409 units differ (structure 2 vs detail 3)
- Food Engineering: GET 299 sits under the '400 Level' heading (p.460) but its number implies 200; heading kept, source likely omits a level heading
- Food Engineering: GET 399 sits under the '400 Level' heading (p.460) but its number implies 300; heading kept, source likely omits a level heading
- Food Engineering: duplicate structure row GET 499 @ level 400 (kept first)
- Food Engineering: duplicate structure row GET 404 @ level 400 (kept first)
- Food Engineering: FDE 501 units differ (structure 2 vs detail 3)
- Food Engineering: FDE 502 units differ (structure 2 vs detail 3)
- Food Engineering: GET 206 is described under '200 Level' (p.471) but not listed in the level table; added from the course description
- Food Engineering: FDE 201 is described under '200 Level' (p.474) but not listed in the level table; added from the course description
- Food Engineering: GET 304 is described under '300 Level' (p.476) but not listed in the level table; added from the course description
- Food Science and Technology: GET 203 units differ (structure 2 vs detail 3)
- Food Science and Technology: GET 307 units differ (structure 2 vs detail 3)
- Food Science and Technology: GET 299 sits under the '400 Level' heading (p.504) but its number implies 200; heading kept, source likely omits a level heading
- Food Science and Technology: GET 399 sits under the '400 Level' heading (p.504) but its number implies 300; heading kept, source likely omits a level heading
- Food Science and Technology: GET 399 units differ (structure 4 vs detail 3)
- Food Science and Technology: FST 513 units differ (structure 1 vs detail 3)
- Food Science and Technology: FST 427 is described under '400 Level' (p.528) but not listed in the level table; added from the course description
- Information and Communication Engineering: GET 299 sits under the '400 Level' heading (p.543) but its number implies 200; heading kept, source likely omits a level heading
- Information and Communication Engineering: GET 399 sits under the '400 Level' heading (p.543) but its number implies 300; heading kept, source likely omits a level heading
- Information and Communication Engineering: duplicate structure row GET 404 @ level 400 (kept first)
- Information and Communication Engineering: ICE 313 is described under '300 Level' (p.563) but not listed in the level table; added from the course description
- Information and Communication Engineering: ICE 516 is described under '500 Level' (p.571) but not listed in the level table; added from the course description
- Information and Communication Engineering: ICE 529 is described under '500 Level' (p.571) but not listed in the level table; added from the course description
- Industrial and Production Engineering: IPE 301 units differ (structure 2 vs detail 3)
- Industrial and Production Engineering: GET 299 sits under the '400 Level' heading (p.580) but its number implies 200; heading kept, source likely omits a level heading
- Industrial and Production Engineering: GET 399 sits under the '400 Level' heading (p.580) but its number implies 300; heading kept, source likely omits a level heading
- Industrial and Production Engineering: duplicate structure row GET 404 @ level 400 (kept first)
- Marine and Offshore Engineering: PHY 107 units differ (structure 2 vs detail 1)
- Marine and Offshore Engineering: GET 299 sits under the '300 Level' heading (p.618) but its number implies 200; heading kept, source likely omits a level heading
- Marine and Offshore Engineering: GET 499 sits under the '300 Level' heading (p.618) but its number implies 400; heading kept, source likely omits a level heading
- Marine and Offshore Engineering: GET 404 sits under the '300 Level' heading (p.618) but its number implies 400; heading kept, source likely omits a level heading
- Marine and Offshore Engineering: duplicate structure row GET 402 @ level 400 (kept first)
- Marine and Offshore Engineering: duplicate structure row GET 404 @ level 400 (kept first)
- Marine and Offshore Engineering: duplicate structure row MAR 421 @ level 400 (kept first)
- Marine and Offshore Engineering: duplicate structure row GET 501 @ level 500 (kept first)
- Marine and Offshore Engineering: duplicate structure row GET 502 @ level 500 (kept first)
- Marine and Offshore Engineering: duplicate structure row MAR 521 @ level 500 (kept first)
- Marine and Offshore Engineering: MAR 523 units differ (structure 3 vs detail 2)
- Marine and Offshore Engineering: duplicate structure row MAR 534 @ level 500 (kept first)
- Marine and Offshore Engineering: duplicate structure row GET 402 @ level 400 (kept first)
- Marine and Offshore Engineering: duplicate structure row GET 404 @ level 400 (kept first)
- Marine and Offshore Engineering: duplicate structure row MAR 423 @ level 400 (kept first)
- Marine and Offshore Engineering: duplicate structure row MAR 431 @ level 400 (kept first)
- Marine and Offshore Engineering: duplicate structure row GET 501 @ level 500 (kept first)
- Marine and Offshore Engineering: duplicate structure row GET 502 @ level 500 (kept first)
- Marine and Offshore Engineering: duplicate structure row MAR 534 @ level 500 (kept first)
- Marine and Offshore Engineering: PHY 108 is described under '100 Level' (p.626) but not listed in the level table; added from the course description
- Marine and Offshore Engineering: MAR 461 is described under '400 Level' (p.643) but not listed in the level table; added from the course description
- Marine and Offshore Engineering: MAR 513 is described under '500 Level' (p.646) but not listed in the level table; added from the course description
- Materials and Metallurgical Engineering: GET 203 units differ (structure 2 vs detail 3)
- Materials and Metallurgical Engineering: GET 299 sits under the '400 Level' heading (p.661) but its number implies 200; heading kept, source likely omits a level heading
- Materials and Metallurgical Engineering: GET 399 sits under the '400 Level' heading (p.661) but its number implies 300; heading kept, source likely omits a level heading
- Materials and Metallurgical Engineering: duplicate structure row GET 404 @ level 400 (kept first)
- Materials and Metallurgical Engineering: MME 509 is described under '500 Level' (p.687) but not listed in the level table; added from the course description
- Materials and Metallurgical Engineering: MME 514 is described under '500 Level' (p.688) but not listed in the level table; added from the course description
- Mineral Processing and Chemical Metallurgical Engineering: GET 306 units differ (structure 2 vs detail 3)
- Mineral Processing and Chemical Metallurgical Engineering: MPE 301 units differ (structure 1 vs detail 2)
- Mineral Processing and Chemical Metallurgical Engineering: GET 299 sits under the '400 Level' heading (p.698) but its number implies 200; heading kept, source likely omits a level heading
- Mineral Processing and Chemical Metallurgical Engineering: GET 399 sits under the '400 Level' heading (p.698) but its number implies 300; heading kept, source likely omits a level heading
- Mineral Processing and Chemical Metallurgical Engineering: GET 399 units differ (structure 4 vs detail 3)
- Mechanical Engineering: MEE 401 units differ (structure 2 vs detail 3)
- Mechanical Engineering: GET 299 sits under the '400 Level' heading (p.740) but its number implies 200; heading kept, source likely omits a level heading
- Mechanical Engineering: GET 399 sits under the '400 Level' heading (p.740) but its number implies 300; heading kept, source likely omits a level heading
- Mechanical Engineering: duplicate structure row GET 404 @ level 400 (kept first)
- Mechanical Engineering: MEE 301 is described under '300 Level' (p.760) but not listed in the level table; added from the course description
- Mechanical Engineering: MEE 406 is described under '400 Level' (p.764) but not listed in the level table; added from the course description
- Mechanical Engineering: MEE 503 is described under '500 Level' (p.766) but not listed in the level table; added from the course description
- Mechanical Engineering: MEE 509 is described under '500 Level' (p.767) but not listed in the level table; added from the course description
- Mechatronics Engineering: GET 203 units differ (structure 3 vs detail 2)
- Mechatronics Engineering: GET 299 sits under the '400 Level' heading (p.778) but its number implies 200; heading kept, source likely omits a level heading
- Mechatronics Engineering: GET 399 sits under the '400 Level' heading (p.778) but its number implies 300; heading kept, source likely omits a level heading
- Mechatronics Engineering: duplicate structure row GET 499 @ level 400 (kept first)
- Mechatronics Engineering: duplicate structure row GET 404 @ level 400 (kept first)
- Mechatronics Engineering: GST 112 is described under '100 Level' (p.779) but not listed in the level table; added from the course description
- Mechatronics Engineering: PHY 108 is described under '100 Level' (p.785) but not listed in the level table; added from the course description
- Mechatronics Engineering: GET 207 is described under '200 Level' (p.790) but not listed in the level table; added from the course description
- Mechatronics Engineering: MCE 599 is described under '500 Level' (p.806) but not listed in the level table; added from the course description
- Metallurgical Engineering: GET 299 sits under the '400 Level' heading (p.816) but its number implies 200; heading kept, source likely omits a level heading
- Metallurgical Engineering: GET 399 sits under the '400 Level' heading (p.816) but its number implies 300; heading kept, source likely omits a level heading
- Metallurgical Engineering: duplicate structure row GET 404 @ level 400 (kept first)
- Metallurgical Engineering: ENT 312 is described under '200 Level' (p.830) but not listed in the level table; added from the course description
- Metallurgical Engineering: GET 302 is described under '200 Level' (p.831) but not listed in the level table; added from the course description
- Metallurgical Engineering: MTE 304 is described under '200 Level' (p.836) but not listed in the level table; added from the course description
- Metallurgical Engineering: MTE 306 is described under '200 Level' (p.837) but not listed in the level table; added from the course description
- Metallurgical Engineering: MTE 308 is described under '200 Level' (p.838) but not listed in the level table; added from the course description
- Metallurgical Engineering: MTE 413 is described under '400 Level' (p.842) but not listed in the level table; added from the course description
- Metallurgical Engineering: MTE 502 is described under '500 Level' (p.844) but not listed in the level table; added from the course description
- Metallurgical Engineering: MTE 503 is described under '500 Level' (p.844) but not listed in the level table; added from the course description
- Metallurgical Engineering: MTE 504 is described under '500 Level' (p.845) but not listed in the level table; added from the course description
- Metallurgical Engineering: MTE 505 is described under '500 Level' (p.845) but not listed in the level table; added from the course description
- Metallurgical Engineering: MTE 506 is described under '500 Level' (p.845) but not listed in the level table; added from the course description
- Metallurgical Engineering: MTE 508 is described under '500 Level' (p.846) but not listed in the level table; added from the course description
- Materials Engineering: GET 299 sits under the '400 Level' heading (p.861) but its number implies 200; heading kept, source likely omits a level heading
- Materials Engineering: GET 399 sits under the '400 Level' heading (p.861) but its number implies 300; heading kept, source likely omits a level heading
- Materials Engineering: GET 399 units differ (structure 4 vs detail 3)
- Materials Engineering: duplicate structure row GET 404 @ level 400 (kept first)
- Materials Engineering: MAE 401 is described under '400 Level' (p.882) but not listed in the level table; added from the course description
- Mining Engineering: PHY 107 units differ (structure 2 vs detail 1)
- Mining Engineering: MNE 104 units differ (structure 3 vs detail 2)
- Mining Engineering: MNE 302 units differ (structure 3 vs detail 2)
- Mining Engineering: GET 299 sits under the '400 Level' heading (p.895) but its number implies 200; heading kept, source likely omits a level heading
- Mining Engineering: GET 399 sits under the '400 Level' heading (p.895) but its number implies 300; heading kept, source likely omits a level heading
- Mining Engineering: duplicate structure row GET 404 @ level 400 (kept first)
- Mining Engineering: PHY 108 is described under '100 Level' (p.902) but not listed in the level table; added from the course description
- Natural Gas Engineering: GET 299 sits under the '400 Level' heading (p.937) but its number implies 200; heading kept, source likely omits a level heading
- Natural Gas Engineering: GET 399 sits under the '400 Level' heading (p.937) but its number implies 300; heading kept, source likely omits a level heading
- Natural Gas Engineering: duplicate structure row GET 404 @ level 400 (kept first)
- Nuclear Engineering: NUE 405 units differ (structure 2 vs detail 1)
- Nuclear Engineering: NUE 407 units differ (structure 1 vs detail 2)
- Nuclear Engineering: GET 299 sits under the '400 Level' heading (p.974) but its number implies 200; heading kept, source likely omits a level heading
- Nuclear Engineering: GET 399 sits under the '400 Level' heading (p.974) but its number implies 300; heading kept, source likely omits a level heading
- Nuclear Engineering: GET 399 units differ (structure 4 vs detail 3)
- Nuclear Engineering: duplicate structure row GET 499 @ level 400 (kept first)
- Nuclear Engineering: duplicate structure row GET 404 @ level 400 (kept first)
- Nuclear Engineering: GET 501 units differ (structure 3 vs detail 2)
- Nuclear Engineering: NUE 599 units differ (structure 5 vs detail 4)
- Nuclear Engineering: PHY 103 is described under '100 Level' (p.978) but not listed in the level table; added from the course description
- Nuclear Engineering: GST 212 is described under '200 Level' (p.981) but not listed in the level table; added from the course description
- Nuclear Engineering: ENT 211 is described under '200 Level' (p.982) but not listed in the level table; added from the course description
- Nuclear Engineering: GST 312 is described under '300 Level' (p.987) but not listed in the level table; added from the course description
- Nuclear Engineering: ENT 312 is described under '300 Level' (p.988) but not listed in the level table; added from the course description
- Nuclear Engineering: GET 304 is described under '300 Level' (p.989) but not listed in the level table; added from the course description
- Nuclear Engineering: GET 305 is described under '300 Level' (p.990) but not listed in the level table; added from the course description
- Nuclear Engineering: NUE 302 is described under '300 Level' (p.992) but not listed in the level table; added from the course description
- Nuclear Engineering: NUE 303 is described under '300 Level' (p.992) but not listed in the level table; added from the course description
- Nuclear Engineering: NUE 304 is described under '300 Level' (p.993) but not listed in the level table; added from the course description
- Petrochemical Engineering: GET 299 sits under the '400 Level' heading (p.1009) but its number implies 200; heading kept, source likely omits a level heading
- Petrochemical Engineering: GET 399 sits under the '400 Level' heading (p.1009) but its number implies 300; heading kept, source likely omits a level heading
- Petrochemical Engineering: duplicate structure row GET 404 @ level 400 (kept first)
- Petrochemical Engineering: PCE 501 units differ (structure 2 vs detail 3)
- Petrochemical Engineering: PCE 502 units differ (structure 3 vs detail 2)
- Petrochemical Engineering: PCE 112 is described under '100 Level' (p.1016) but not listed in the level table; added from the course description
- Petrochemical Engineering: PCE 307 is described under '300 Level' (p.1030) but not listed in the level table; added from the course description
- Petroleum and Gas Engineering: PGE 302 units differ (structure 2 vs detail 3)
- Petroleum and Gas Engineering: GET 299 sits under the '400 Level' heading (p.1049) but its number implies 200; heading kept, source likely omits a level heading
- Petroleum and Gas Engineering: GET 399 sits under the '400 Level' heading (p.1049) but its number implies 300; heading kept, source likely omits a level heading
- Petroleum and Gas Engineering: duplicate structure row GET 404 @ level 400 (kept first)
- Petroleum and Gas Engineering: PGE 510 is described under '500 Level' (p.1077) but not listed in the level table; added from the course description
- Petroleum Engineering: GET 301 sits under the '200 Level' heading (p.1086) but its number implies 300; heading kept, source likely omits a level heading
- Petroleum Engineering: GET 399 sits under the '400 Level' heading (p.1087) but its number implies 300; heading kept, source likely omits a level heading
- Petroleum Engineering: GET 299 sits under the '400 Level' heading (p.1087) but its number implies 200; heading kept, source likely omits a level heading
- Petroleum Engineering: duplicate structure row GET 399 @ level 400 (kept first)
- Petroleum Engineering: duplicate structure row GET 404 @ level 400 (kept first)
- Petroleum Engineering: GET 501 sits under the '400 Level' heading (p.1087) but its number implies 500; heading kept, source likely omits a level heading
- Petroleum Engineering: GET 502 sits under the '400 Level' heading (p.1087) but its number implies 500; heading kept, source likely omits a level heading
- Petroleum Engineering: PEE 508 sits under the '400 Level' heading (p.1087) but its number implies 500; heading kept, source likely omits a level heading
- Petroleum Engineering: PEE 314 is described under '300 Level' (p.1109) but not listed in the level table; added from the course description
- Railway Engineering: GET 203 units differ (structure 2 vs detail 3)
- Railway Engineering: RAE 201 units differ (structure 2 vs detail 3)
- Railway Engineering: GET 299 sits under the '400 Level' heading (p.1125) but its number implies 200; heading kept, source likely omits a level heading
- Railway Engineering: GET 399 sits under the '400 Level' heading (p.1125) but its number implies 300; heading kept, source likely omits a level heading
- Railway Engineering: GET 399 units differ (structure 4 vs detail 3)
- Railway Engineering: duplicate structure row GET 404 @ level 400 (kept first)
- Railway Engineering: MTH 102 is described under '100 Level' (p.1128) but not listed in the level table; added from the course description
- Structural Engineering: GET 203 units differ (structure 2 vs detail 3)
- Structural Engineering: STE 405 units differ (structure 3 vs detail 2)
- Structural Engineering: STE 407 units differ (structure 3 vs detail 2)
- Structural Engineering: GET 299 sits under the '400 Level' heading (p.1164) but its number implies 200; heading kept, source likely omits a level heading
- Structural Engineering: GET 399 sits under the '400 Level' heading (p.1164) but its number implies 300; heading kept, source likely omits a level heading
- Structural Engineering: duplicate structure row GET 404 @ level 400 (kept first)
- Systems Engineering: GET 299 sits under the '400 Level' heading (p.1199) but its number implies 200; heading kept, source likely omits a level heading
- Systems Engineering: GET 399 sits under the '400 Level' heading (p.1199) but its number implies 300; heading kept, source likely omits a level heading
- Systems Engineering: duplicate structure row GET 404 @ level 400 (kept first)
- Systems Engineering: SSG 531 is described under '400 Level' (p.1225) but not listed in the level table; added from the course description
- Telecommunications Engineering: GET 299 sits under the '400 Level' heading (p.1234) but its number implies 200; heading kept, source likely omits a level heading
- Telecommunications Engineering: GET 399 sits under the '400 Level' heading (p.1234) but its number implies 300; heading kept, source likely omits a level heading
- Telecommunications Engineering: duplicate structure row GET 404 @ level 400 (kept first)
- Water Resources Engineering: GST 211 sits under the '100 Level' heading (p.1269) but its number implies 200; heading kept, source likely omits a level heading
- Water Resources Engineering: ENT 312 sits under the '200 Level' heading (p.1270) but its number implies 300; heading kept, source likely omits a level heading
- Water Resources Engineering: GST 321 sits under the '200 Level' heading (p.1270) but its number implies 300; heading kept, source likely omits a level heading
- Water Resources Engineering: GET 304 sits under the '200 Level' heading (p.1270) but its number implies 300; heading kept, source likely omits a level heading
- Water Resources Engineering: GET 305 sits under the '200 Level' heading (p.1270) but its number implies 300; heading kept, source likely omits a level heading
- Water Resources Engineering: GET 306 sits under the '200 Level' heading (p.1270) but its number implies 300; heading kept, source likely omits a level heading
- Water Resources Engineering: GET 307 sits under the '200 Level' heading (p.1270) but its number implies 300; heading kept, source likely omits a level heading
- Water Resources Engineering: CEE 304 sits under the '200 Level' heading (p.1270) but its number implies 300; heading kept, source likely omits a level heading
- Water Resources Engineering: CEE 304 units differ (structure 2 vs detail 3)
- Water Resources Engineering: WRE 301 sits under the '200 Level' heading (p.1270) but its number implies 300; heading kept, source likely omits a level heading
- Water Resources Engineering: WRE 303 sits under the '200 Level' heading (p.1270) but its number implies 300; heading kept, source likely omits a level heading
- Water Resources Engineering: WRE 303 units differ (structure 2 vs detail 3)
- Water Resources Engineering: WRE 308 sits under the '200 Level' heading (p.1270) but its number implies 300; heading kept, source likely omits a level heading
- Water Resources Engineering: GET 299 sits under the '400 Level' heading (p.1271) but its number implies 200; heading kept, source likely omits a level heading
- Water Resources Engineering: GET 399 sits under the '400 Level' heading (p.1271) but its number implies 300; heading kept, source likely omits a level heading
- Water Resources Engineering: duplicate structure row GET 404 @ level 400 (kept first)
- Water Resources Engineering: GST 112 is described under '100 Level' (p.1272) but not listed in the level table; added from the course description
- Water Resources Engineering: GST 312 is described under '300 Level' (p.1283) but not listed in the level table; added from the course description
- Wood Products Engineering: PHY 107 units differ (structure 2 vs detail 1)
- Wood Products Engineering: WPE 311 units differ (structure 1 vs detail 2)
- Wood Products Engineering: GET 299 sits under the '400 Level' heading (p.1303) but its number implies 200; heading kept, source likely omits a level heading
- Wood Products Engineering: GET 399 sits under the '400 Level' heading (p.1303) but its number implies 300; heading kept, source likely omits a level heading
- Wood Products Engineering: duplicate structure row GET 404 @ level 400 (kept first)
- Wood Products Engineering: PHY 108 is described under '100 Level' (p.1310) but not listed in the level table; added from the course description
