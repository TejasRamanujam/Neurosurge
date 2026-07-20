import unittest

from app.flashcard_parser import parse_flashcard_suggestions


class FlashcardParserTests(unittest.TestCase):
    def test_parses_and_filters_suggestions(self):
        result = parse_flashcard_suggestions(
            '[{"question":"What is recall?","answer":"Retrieving knowledge."},'
            '{"question":"","answer":"skip"}]'
        )
        self.assertEqual(
            result,
            [{"question": "What is recall?", "answer": "Retrieving knowledge."}],
        )

    def test_accepts_wrapped_payload_and_caps_results(self):
        raw = '{"flashcards": [' + ",".join(
            f'{{"question":"Q{i}","answer":"A{i}"}}' for i in range(8)
        ) + "]}"
        self.assertEqual(len(parse_flashcard_suggestions(raw)), 6)

    def test_rejects_empty_payload(self):
        with self.assertRaises(ValueError):
            parse_flashcard_suggestions("[]")


if __name__ == "__main__":
    unittest.main()
