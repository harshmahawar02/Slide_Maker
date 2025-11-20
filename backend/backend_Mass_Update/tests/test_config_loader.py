import io
import os
import sys
import tempfile
import unittest
from contextlib import redirect_stdout

from utils.config_loader import load_replacements


class TestConfigLoader(unittest.TestCase):
    def write_file(self, content):
        fd, path = tempfile.mkstemp(suffix='.properties', text=True)
        os.close(fd)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        return path

    def test_basic_parsing(self):
        content = """
# comment line
key1=value1
key2 = value with spaces
"""
        path = self.write_file(content)
        try:
            d = load_replacements(path)
            self.assertEqual(d['key1'], 'value1')
            self.assertEqual(d['key2'], 'value with spaces')
        finally:
            os.remove(path)

    def test_ignored_comments_and_bom(self):
        # A line starts with BOM/zero-width before '#', it should still be treated as comment
        content = "\ufeff #hidden comment\nreal=ok\n"
        path = self.write_file(content)
        try:
            d = load_replacements(path)
            self.assertIn('real', d)
            self.assertNotIn('\ufeff #hidden comment', d)
        finally:
            os.remove(path)

    def test_malformed_lines_reported(self):
        content = "good=1\nbadlinewithoutsep\n#comment\n"
        path = self.write_file(content)
        try:
            buf = io.StringIO()
            with redirect_stdout(buf):
                d = load_replacements(path)
            out = buf.getvalue()
            # malformed line should not be in dict and a warning should be printed
            self.assertNotIn('badlinewithoutsep', d)
            self.assertIn('malformed', out.lower())
        finally:
            os.remove(path)

    def test_duplicate_keys_warn_and_overwrite(self):
        content = "k=first\nk=second\n"
        path = self.write_file(content)
        try:
            buf = io.StringIO()
            with redirect_stdout(buf):
                d = load_replacements(path)
            out = buf.getvalue()
            # last value should overwrite
            self.assertEqual(d['k'], 'second')
            # warning should mention duplicate
            self.assertIn('duplicate', out.lower())
        finally:
            os.remove(path)


if __name__ == '__main__':
    unittest.main()
