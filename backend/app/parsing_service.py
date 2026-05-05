import io
import logging
import re
from pathlib import Path
from typing import Optional

logger = logging.getLogger("neurosurge.parsing")

try:
    import fitz
except ImportError:
    fitz = None

try:
    from docx import Document
except ImportError:
    Document = None

try:
    from pdfminer.high_level import extract_text as pdfminer_extract
except ImportError:
    pdfminer_extract = None


def _clean_control_chars(text: str) -> str:
    cleaned = []
    for c in text:
        if c in ("\n", "\r", "\t"):
            cleaned.append(c)
        elif c.isprintable():
            cleaned.append(c)
        elif ord(c) < 32:
            cleaned.append(" ")
        else:
            cleaned.append(c)
    return "".join(cleaned)


def _extract_pdf_text_via_fitz(content: bytes) -> Optional[str]:
    try:
        doc = fitz.open(stream=content, filetype="pdf")
        all_text = []
        for page in doc:
            extracted = None
            for method in ("text", "blocks", "raw"):
                try:
                    if method == "text":
                        t = page.get_text("text")
                    elif method == "blocks":
                        blocks = page.get_text("blocks")
                        t = "\n".join(b[4] for b in blocks if b[4].strip()) if blocks else ""
                    else:
                        t = page.get_text("raw")
                        t = _clean_control_chars(t) if t else ""
                    if t and len(t.strip()) > 10:
                        extracted = t.strip()
                        break
                except Exception:
                    continue
            if extracted:
                all_text.append(extracted)
        doc.close()

        if not all_text:
            return None

        full = "\n".join(all_text)
        full = _clean_control_chars(full)
        full = re.sub(r"\n{3,}", "\n\n", full)
        full = re.sub(r" {3,}", " ", full).strip()

        return full if len(full) >= 10 else None
    except Exception as e:
        logger.warning("PyMuPDF failed: %s", e)
        return None


def extract_text_from_pdf(content: bytes) -> Optional[str]:
    if fitz is not None:
        text = _extract_pdf_text_via_fitz(content)
        if text:
            logger.info("fitz extracted %d chars", len(text))
            return text

    if pdfminer_extract is not None:
        try:
            text = pdfminer_extract(io.BytesIO(content))
            text = _clean_control_chars(text).strip()
            if len(text) >= 10:
                logger.info("pdfminer extracted %d chars", len(text))
                return text
        except Exception as e:
            logger.warning("pdfminer failed: %s", e)

    return None


def extract_text_from_docx(content: bytes) -> Optional[str]:
    if Document is None:
        return None
    try:
        doc = Document(io.BytesIO(content))
        texts = [p.text for p in doc.paragraphs if p.text.strip()]
        result = "\n".join(texts)
        return result if result.strip() else None
    except Exception as e:
        logger.warning("DOCX extraction failed: %s", e)
    return None


def extract_text_from_doc(content: bytes) -> Optional[str]:
    try:
        import olefile
        if olefile.isOleFile(io.BytesIO(content)):
            with olefile.OleFileIO(io.BytesIO(content)) as ole:
                if ole.exists("WordDocument"):
                    stream = ole.openstream("WordDocument")
                    raw = stream.read()
                    try:
                        text = raw.decode("utf-8", errors="ignore")
                    except Exception:
                        text = raw.decode("latin-1", errors="ignore")
                    text = re.sub(r"[^\x20-\x7E\n]", " ", text)
                    text = re.sub(r"\s+", " ", text).strip()
                    if text and len(text) > 20:
                        return text[:50000]
    except ImportError:
        pass
    except Exception as e:
        logger.warning("DOC extraction failed: %s", e)
    return extract_text_from_docx(content)


SUPPORTED_EXTENSIONS = {
    ".pdf": extract_text_from_pdf,
    ".docx": extract_text_from_docx,
    ".doc": extract_text_from_doc,
}


def extract_text_from_file(filename: str, content: bytes) -> Optional[str]:
    ext = Path(filename).suffix.lower()
    handler = SUPPORTED_EXTENSIONS.get(ext)
    if handler is None:
        logger.warning("Unsupported extension: %s", ext)
        return None
    return handler(content)
