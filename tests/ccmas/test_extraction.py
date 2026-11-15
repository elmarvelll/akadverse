"""Regression checks for typography variants in the supplied CCMAS edition."""
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('extract_ccmas', Path(__file__).resolve().parents[2] / 'scripts/ccmas/extract_ccmas.py')
extract = importlib.util.module_from_spec(spec)
spec.loader.exec_module(extract)

class ExtractionTests(unittest.TestCase):
    def test_running_footer_does_not_corrupt_course_title(self):
        lines = extract.clean_lines('300 Level\nEEE 311 Electric Circuit Theory I 2 C 30 -\nEngineering and Technology 391 New', 391)
        rows = extract.parse_structure([(391, line) for line in lines])
        self.assertEqual(rows[0]['title'], 'Electric Circuit Theory I')
        self.assertEqual(rows[0]['creditUnits'], 2)
        self.assertIsNone(rows[0]['semester'])

    def test_printed_ice_level_typo_does_not_allocate_200_courses_to_100(self):
        rows = extract.parse_structure([(542, '100 Level'), (542, 'ICE 101 Introduction to ICE and Applications 2 C 30 -'), (542, '200 Leve'), (542, 'ICE 221 Electronics I: Physical and Analogue 1 C 15 -')])
        self.assertEqual([row['level'] for row in rows], [100, 200])
        self.assertEqual(rows[1]['code'], 'ICE 221')

    def test_semester_is_never_inferred_from_course_number(self):
        rows = extract.parse_structure([(391, '300 Level'), (391, 'EEE 322 Digital Electronic Circuits 2 C 30 -')])
        self.assertIsNone(rows[0]['semester'])

if __name__ == '__main__':
    unittest.main()
