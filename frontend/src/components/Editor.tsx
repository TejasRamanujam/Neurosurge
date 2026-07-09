import { useCallback, useEffect, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as PMNode } from '@tiptap/pm/model'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Highlight from '@tiptap/extension-highlight'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import ImageExt from '@tiptap/extension-image'
import { formatContent } from '../api'

/* Survey marks: highlight [[wikilinks]] and #hashtags inline via decorations. */
const WIKI_RE = /\[\[([^\[\]]+)\]\]/g
const TAG_RE = /(^|[\s(])#([A-Za-z0-9_][\w/-]*)/g

function buildDecorations(doc: PMNode): DecorationSet {
  const decos: Decoration[] = []
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return
    const text = node.text
    for (const m of text.matchAll(WIKI_RE)) {
      const from = pos + (m.index || 0)
      decos.push(Decoration.inline(from, from + m[0].length, { class: 'pm-wikilink', 'data-wikilink': m[1].trim() }))
    }
    for (const m of text.matchAll(TAG_RE)) {
      const from = pos + (m.index || 0) + m[1].length
      decos.push(Decoration.inline(from, from + m[2].length + 1, { class: 'pm-hashtag' }))
    }
  })
  return DecorationSet.create(doc, decos)
}

const SurveyMarks = Extension.create({
  name: 'surveyMarks',
  addProseMirrorPlugins() {
    const key = new PluginKey('surveyMarks')
    return [
      new Plugin({
        key,
        state: {
          init: (_config, { doc }) => buildDecorations(doc),
          apply: (tr, old) => (tr.docChanged ? buildDecorations(tr.doc) : old),
        },
        props: {
          decorations(state) {
            return key.getState(state)
          },
        },
      }),
    ]
  },
})

function QuillButton({
  onClick, on, title, children,
}: { onClick: () => void; on?: boolean; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      className={`quill-btn${on ? ' on' : ''}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={on}
    >
      {children}
    </button>
  )
}

export default function Editor({
  content,
  onChange,
  onWikilink,
}: {
  content: string
  onChange: (html: string) => void
  onWikilink: (title: string) => void
}) {
  const [formatting, setFormatting] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder: 'Begin the entry… link ideas with [[Note Title]] and mark themes with #tags.' }),
      Underline,
      Link.configure({ openOnClick: false }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight,
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      ImageExt,
      SurveyMarks,
    ],
    content,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  })

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content, false)
    }
  }, [content, editor])

  const toggleLink = useCallback(() => {
    if (!editor) return
    const prev = editor.getAttributes('link').href
    const url = window.prompt('Link URL:', prev || '')
    if (url === null) return
    if (url === '') editor.chain().focus().unsetLink().run()
    else editor.chain().focus().setLink({ href: url }).run()
  }, [editor])

  const addImage = useCallback(() => {
    if (!editor) return
    const url = window.prompt('Image URL:')
    if (url) editor.chain().focus().setImage({ src: url }).run()
  }, [editor])

  const handleFormat = useCallback(async () => {
    if (!editor || formatting) return
    setFormatting(true)
    try {
      const formatted = await formatContent(editor.getHTML())
      editor.commands.setContent(formatted, false)
      onChange(formatted)
    } catch (err) {
      console.error('Format failed:', err)
    } finally {
      setFormatting(false)
    }
  }, [editor, formatting, onChange])

  const handleProseClick = useCallback((e: React.MouseEvent) => {
    const el = (e.target as HTMLElement).closest?.('.pm-wikilink') as HTMLElement | null
    if (el) {
      const t = el.getAttribute('data-wikilink') || el.textContent?.replace(/^\[\[|\]\]$/g, '') || ''
      if (t.trim()) onWikilink(t.trim())
    }
  }, [onWikilink])

  if (!editor) return null

  return (
    <>
      <div className="quill-bar" role="toolbar" aria-label="Formatting">
        <QuillButton onClick={() => editor.chain().focus().toggleBold().run()} on={editor.isActive('bold')} title="Bold"><strong>B</strong></QuillButton>
        <QuillButton onClick={() => editor.chain().focus().toggleItalic().run()} on={editor.isActive('italic')} title="Italic"><em style={{ fontFamily: 'var(--font-display)' }}>I</em></QuillButton>
        <QuillButton onClick={() => editor.chain().focus().toggleUnderline().run()} on={editor.isActive('underline')} title="Underline"><u>U</u></QuillButton>
        <QuillButton onClick={() => editor.chain().focus().toggleStrike().run()} on={editor.isActive('strike')} title="Strikethrough"><s>S</s></QuillButton>
        <QuillButton onClick={() => editor.chain().focus().toggleHighlight().run()} on={editor.isActive('highlight')} title="Highlight">hl</QuillButton>
        <QuillButton onClick={() => editor.chain().focus().toggleCode().run()} on={editor.isActive('code')} title="Inline code">{'<>'}</QuillButton>
        <div className="quill-sep" />
        <QuillButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} on={editor.isActive('heading', { level: 1 })} title="Heading 1">H1</QuillButton>
        <QuillButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} on={editor.isActive('heading', { level: 2 })} title="Heading 2">H2</QuillButton>
        <QuillButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} on={editor.isActive('heading', { level: 3 })} title="Heading 3">H3</QuillButton>
        <div className="quill-sep" />
        <QuillButton onClick={() => editor.chain().focus().toggleBulletList().run()} on={editor.isActive('bulletList')} title="Bullet list">•–</QuillButton>
        <QuillButton onClick={() => editor.chain().focus().toggleOrderedList().run()} on={editor.isActive('orderedList')} title="Numbered list">1.</QuillButton>
        <QuillButton onClick={() => editor.chain().focus().toggleTaskList().run()} on={editor.isActive('taskList')} title="Task list">☑</QuillButton>
        <QuillButton onClick={() => editor.chain().focus().toggleBlockquote().run()} on={editor.isActive('blockquote')} title="Blockquote">❝</QuillButton>
        <QuillButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} on={editor.isActive('codeBlock')} title="Code block">{ '{ }' }</QuillButton>
        <QuillButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Divider">✦</QuillButton>
        <div className="quill-sep" />
        <QuillButton onClick={toggleLink} on={editor.isActive('link')} title="Link">⌁</QuillButton>
        <QuillButton onClick={addImage} title="Image">▣</QuillButton>
        <QuillButton onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="Table">⊞</QuillButton>
        <div className="quill-sep" />
        <QuillButton onClick={() => editor.chain().focus().undo().run()} title="Undo">↩</QuillButton>
        <QuillButton onClick={() => editor.chain().focus().redo().run()} title="Redo">↪</QuillButton>
        <div className="quill-sep" />
        <QuillButton onClick={handleFormat} title="Auto-format for readability">{formatting ? '…' : '✧ tidy'}</QuillButton>
      </div>
      <div className="prose" onClick={handleProseClick}>
        <EditorContent editor={editor} />
      </div>
    </>
  )
}
