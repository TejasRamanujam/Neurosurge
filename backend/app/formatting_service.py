import re
from typing import List


def strip_html(text: str) -> str:
    text = re.sub(r"<[^>]+>", "\n", text)
    text = re.sub(r"&[a-zA-Z]+;", " ", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n\s*\n", "\n\n", text)
    text = re.sub(r"^\n+|\n+$", "", text)
    return text


def detect_bullet(line: str) -> bool:
    stripped = line.strip()
    return bool(re.match(r"^[\-\*•‣⁃◦▪●◆◇→⇒✓☐☑☒▶‣⁌⁍](\s|$)", stripped)) or bool(
        re.match(r"^\d+[\).]\s", stripped)
    )


def detect_numbered(line: str) -> bool:
    return bool(re.match(r"^\d+[\).]\s", line.strip()))


def detect_header(line: str) -> bool:
    s = line.strip()
    if not s:
        return False
    if len(s) > 100:
        return False
    if re.match(r"^[A-Z\s]{3,}$", s) and len(s) > 5:
        return True
    if s.endswith(":") and len(s) < 80:
        return True
    if re.match(r"^(Section|Chapter|Part|Step|Phase)\s+\d", s, re.IGNORECASE):
        return True
    if re.match(r"^[A-Z][a-z]+(\s[A-Z][a-z]+){1,4}$", s) and len(s) < 60:
        return True
    return False


def detect_paragraph_break(line: str) -> bool:
    s = line.strip()
    if not s:
        return True
    if len(s) < 15 and s.endswith((".", "!", "?", ":", ";")):
        return True
    return False


def merge_short_lines(lines: List[str], min_chars: int = 60) -> List[str]:
    merged = []
    buffer = ""
    for line in lines:
        s = line.strip()
        if not s:
            if buffer.strip():
                merged.append(buffer.strip())
                buffer = ""
            merged.append("")
            continue
        if detect_bullet(line) or detect_header(line):
            if buffer.strip():
                merged.append(buffer.strip())
                buffer = ""
            merged.append(line)
            continue
        if buffer and len(buffer) + len(s) < min_chars * 2:
            buffer += " " + s
        else:
            if buffer.strip():
                merged.append(buffer.strip())
            buffer = s
    if buffer.strip():
        merged.append(buffer.strip())
    return merged


def split_long_paragraphs(paragraphs: List[str], max_chars: int = 400) -> List[str]:
    result = []
    for p in paragraphs:
        if len(p) <= max_chars:
            result.append(p)
            continue
        sentences = re.split(r"(?<=[.!?])\s+", p)
        chunk = ""
        for s in sentences:
            if len(chunk) + len(s) < max_chars:
                chunk = (chunk + " " + s).strip()
            else:
                if chunk:
                    result.append(chunk)
                chunk = s
        if chunk:
            result.append(chunk)
    return result


def format_text_to_html(raw_text: str) -> str:
    text = strip_html(raw_text)
    if not text.strip():
        return "<p></p>"

    lines = text.split("\n")
    cleaned = []
    for l in lines:
        s = l.strip()
        if s:
            cleaned.append(s)
        else:
            cleaned.append("")

    cleaned = merge_short_lines(cleaned)

    paragraphs = []
    current_para = ""
    for line in cleaned:
        s = line.strip()

        if not s:
            if current_para:
                paragraphs.append(current_para.strip())
                current_para = ""
            paragraphs.append("")
            continue

        if detect_header(s):
            if current_para:
                paragraphs.append(current_para.strip())
                current_para = ""
            paragraphs.append(f"__HEADER__:{s}")
            continue

        if detect_bullet(s):
            if current_para:
                paragraphs.append(current_para.strip())
                current_para = ""
            paragraphs.append(f"__BULLET__:{s}")
            continue

        if current_para:
            current_para += " " + s
        else:
            current_para = s

    if current_para:
        paragraphs.append(current_para.strip())

    paragraphs = split_long_paragraphs(paragraphs)

    html_parts = []
    in_list = False
    in_ol = False

    for p in paragraphs:
        if not p:
            if in_list:
                html_parts.append("</ul>")
                in_list = False
            if in_ol:
                html_parts.append("</ol>")
                in_ol = False
            continue

        if p.startswith("__HEADER__:"):
            if in_list:
                html_parts.append("</ul>")
                in_list = False
            if in_ol:
                html_parts.append("</ol>")
                in_ol = False
            text_content = p[len("__HEADER__:"):].strip()
            if len(text_content) < 40:
                html_parts.append(f"<h3>{escape_html(text_content)}</h3>")
            else:
                html_parts.append(f"<p><strong>{escape_html(text_content)}</strong></p>")
            continue

        if p.startswith("__BULLET__:"):
            text_content = p[len("__BULLET__:"):].strip()
            is_numbered = bool(re.match(r"^\d+[\).]\s", text_content))

            if is_numbered:
                if in_list:
                    html_parts.append("</ul>")
                    in_list = False
                if not in_ol:
                    if html_parts and html_parts[-1] != "</ol>":
                        pass
                    in_ol = True
                text_content = re.sub(r"^\d+[).]\s*", "", text_content)
                html_parts.append(f"<li>{escape_html(text_content)}</li>")
            else:
                if in_ol:
                    html_parts.append("</ol>")
                    in_ol = False
                if not in_list:
                    if html_parts and html_parts[-1] != "</ul>":
                        html_parts.append("<ul>")
                    else:
                        html_parts.append("<ul>")
                    in_list = True
                text_content = re.sub(r"^[\-\*•‣⁃◦▪●◆◇→⇒✓☐☑☒▶‣⁌⁍]\s*", "", text_content)
                html_parts.append(f"<li>{escape_html(text_content)}</li>")
            continue

        if in_list:
            html_parts.append("</ul>")
            in_list = False
        if in_ol:
            html_parts.append("</ol>")
            in_ol = False

        html_parts.append(f"<p>{escape_html(p)}</p>")

    if in_list:
        html_parts.append("</ul>")
    if in_ol:
        html_parts.append("</ol>")

    result = "\n".join(html_parts)
    return result or "<p></p>"


def escape_html(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def format_for_readability(content: str) -> str:
    return format_text_to_html(content)
