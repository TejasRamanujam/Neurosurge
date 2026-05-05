import { useCallback, useEffect, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
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
import { formatContent } from '../../api'

interface TipTapEditorProps {
  content: string
  onChange: (html: string) => void
  placeholder?: string
}

function ToolbarButton({
  onClick,
  isActive,
  title,
  children,
}: {
  onClick: () => void
  isActive?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      className={`toolbar-btn${isActive ? ' is-active' : ''}`}
      onClick={onClick}
      title={title}
    >
      {children}
    </button>
  )
}

export default function TipTapEditor({ content, onChange, placeholder }: TipTapEditorProps) {
  const [formatting, setFormatting] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
      }),
      Placeholder.configure({ placeholder: placeholder || 'Start writing...' }),
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
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
  })

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content, false)
    }
  }, [content, editor])

  const toggleLink = useCallback(() => {
    if (!editor) return
    const prev = editor.getAttributes('link').href
    const url = window.prompt('URL:', prev || '')
    if (url === null) return
    if (url === '') {
      editor.chain().focus().unsetLink().run()
    } else {
      editor.chain().focus().setLink({ href: url }).run()
    }
  }, [editor])

  const addImage = useCallback(() => {
    if (!editor) return
    const url = window.prompt('Image URL:')
    if (url) {
      editor.chain().focus().setImage({ src: url }).run()
    }
  }, [editor])

  const handleFormat = useCallback(async () => {
    if (!editor || formatting) return
    setFormatting(true)
    try {
      const html = editor.getHTML()
      const formatted = await formatContent(html)
      editor.commands.setContent(formatted, false)
      onChange(formatted)
    } catch (err) {
      console.error('Format failed:', err)
    } finally {
      setFormatting(false)
    }
  }, [editor, formatting, onChange])

  if (!editor) return null

  return (
    <div className="editor-wrapper">
      <div className="editor-toolbar">
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')} title="Bold"><strong>B</strong></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')} title="Italic"><em>I</em></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive('underline')} title="Underline"><u>U</u></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive('strike')} title="Strikethrough"><s>S</s></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleCode().run()} isActive={editor.isActive('code')} title="Code">{'<>'}</ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHighlight().run()} isActive={editor.isActive('highlight')} title="Highlight">=</ToolbarButton>

        <div className="toolbar-separator" />

        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} isActive={editor.isActive('heading', { level: 1 })} title="H1">H1</ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive('heading', { level: 2 })} title="H2">H2</ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} isActive={editor.isActive('heading', { level: 3 })} title="H3">H3</ToolbarButton>

        <div className="toolbar-separator" />

        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive('bulletList')} title="Bullet List">•</ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive('orderedList')} title="Ordered List">1.</ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleTaskList().run()} isActive={editor.isActive('taskList')} title="Task List">☑</ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive('blockquote')} title="Blockquote">"</ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal Rule">—</ToolbarButton>

        <div className="toolbar-separator" />

        <ToolbarButton onClick={toggleLink} isActive={editor.isActive('link')} title="Link">🔗</ToolbarButton>
        <ToolbarButton onClick={addImage} title="Image">🖼</ToolbarButton>

        <div className="toolbar-separator" />

        <ToolbarButton onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="Table">⊞</ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Undo">↩</ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Redo">↪</ToolbarButton>

        <div className="toolbar-separator" />

        <ToolbarButton onClick={handleFormat} title="Auto-format text for readability">
          {formatting ? '...' : '✦'}
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}
