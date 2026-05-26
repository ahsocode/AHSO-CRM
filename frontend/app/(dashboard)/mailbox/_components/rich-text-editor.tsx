"use client";

import Color from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Link2,
  List,
  ListOrdered,
  Strikethrough,
  Underline as UnderlineIcon
} from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const FONT_FAMILIES = [
  { label: "Be Vietnam Pro", value: "Be Vietnam Pro, sans-serif" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Courier New", value: "Courier New, monospace" },
  { label: "Times New Roman", value: "Times New Roman, serif" }
];

const FONT_SIZES = ["10", "11", "12", "14", "16", "18", "20", "24", "28", "32"];

const COLORS = [
  "#1C2833", "#C0392B", "#E67E22", "#1E8449",
  "#2E86C1", "#8E44AD", "#95A5B2", "#FFFFFF"
];

interface RichTextEditorProps {
  content?: string;
  placeholder?: string;
  onChange?: (html: string) => void;
  onImageUpload?: (file: File) => Promise<string>;
}

export function RichTextEditor({ content = "", placeholder = "Nội dung email...", onChange, onImageUpload }: RichTextEditorProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false }),
      Underline,
      TextStyle,
      Color,
      FontFamily,
      TextAlign.configure({ types: ["paragraph"] }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "text-primary-mid underline" } }),
      Image.configure({ inline: false, HTMLAttributes: { class: "max-w-full rounded-lg my-2" } }),
      Placeholder.configure({ placeholder })
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "min-h-[220px] p-3 text-sm text-text-primary outline-none prose prose-sm max-w-none"
      }
    }
  });

  useEffect(() => {
    if (!editor || editor.getHTML() === content) {
      return;
    }

    editor.commands.setContent(content, { emitUpdate: false });
  }, [content, editor]);

  const handleInsertLink = useCallback(() => {
    if (!editor) return;
    const url = window.prompt("Nhập URL:");
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  }, [editor]);

  const handleImageChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !editor) return;
    event.target.value = "";

    if (onImageUpload) {
      const url = await onImageUpload(file);
      editor.chain().focus().setImage({ src: url }).run();
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const src = e.target?.result as string;
        editor.chain().focus().setImage({ src }).run();
      };
      reader.readAsDataURL(file);
    }
  }, [editor, onImageUpload]);

  if (!editor) return null;

  const ToolBtn = ({ active, onClick, children, title }: { active?: boolean; onClick: () => void; children: React.ReactNode; title?: string }) => (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded transition",
        active ? "bg-primary-bg text-primary" : "text-text-secondary hover:bg-bg-hover"
      )}
    >
      {children}
    </button>
  );

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border/50 bg-white focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/20">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border/30 bg-bg-subtle px-2 py-1.5">
        {/* Font family */}
        <select
          className="h-7 rounded border-0 bg-transparent px-1 text-xs text-text-secondary focus:outline-none focus:ring-0"
          value={editor.getAttributes("textStyle").fontFamily ?? ""}
          onChange={(e) => e.target.value
            ? editor.chain().focus().setFontFamily(e.target.value).run()
            : editor.chain().focus().unsetFontFamily().run()
          }
        >
          <option value="">Font</option>
          {FONT_FAMILIES.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>

        <div className="mx-1 h-5 w-px bg-border/40" />

        {/* Font size */}
        <select
          className="h-7 w-14 rounded border-0 bg-transparent px-1 text-xs text-text-secondary focus:outline-none focus:ring-0"
          defaultValue="14"
          onChange={(e) => {
            editor.chain().focus().setMark("textStyle", { fontSize: `${e.target.value}px` }).run();
          }}
        >
          {FONT_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <div className="mx-1 h-5 w-px bg-border/40" />

        {/* Format */}
        <ToolBtn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="Đậm (Ctrl+B)">
          <Bold size={14} />
        </ToolBtn>
        <ToolBtn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="Nghiêng (Ctrl+I)">
          <Italic size={14} />
        </ToolBtn>
        <ToolBtn active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Gạch dưới (Ctrl+U)">
          <UnderlineIcon size={14} />
        </ToolBtn>
        <ToolBtn active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} title="Gạch ngang">
          <Strikethrough size={14} />
        </ToolBtn>

        <div className="mx-1 h-5 w-px bg-border/40" />

        {/* Color */}
        <div className="relative flex items-center gap-0.5">
          <span className="text-[10px] text-text-muted">A</span>
          <div className="flex gap-0.5">
            {COLORS.map((color) => (
              <button
                key={color}
                type="button"
                title={color}
                onClick={() => editor.chain().focus().setColor(color).run()}
                className="h-3.5 w-3.5 rounded-sm border border-border/40 transition hover:scale-110"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>

        <div className="mx-1 h-5 w-px bg-border/40" />

        {/* Alignment */}
        <ToolBtn active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()} title="Căn trái">
          <AlignLeft size={14} />
        </ToolBtn>
        <ToolBtn active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()} title="Căn giữa">
          <AlignCenter size={14} />
        </ToolBtn>
        <ToolBtn active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()} title="Căn phải">
          <AlignRight size={14} />
        </ToolBtn>
        <ToolBtn active={editor.isActive({ textAlign: "justify" })} onClick={() => editor.chain().focus().setTextAlign("justify").run()} title="Căn đều">
          <AlignJustify size={14} />
        </ToolBtn>

        <div className="mx-1 h-5 w-px bg-border/40" />

        {/* Lists */}
        <ToolBtn active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Danh sách">
          <List size={14} />
        </ToolBtn>
        <ToolBtn active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Danh sách số">
          <ListOrdered size={14} />
        </ToolBtn>

        <div className="mx-1 h-5 w-px bg-border/40" />

        {/* Link & Image */}
        <ToolBtn active={editor.isActive("link")} onClick={handleInsertLink} title="Chèn link">
          <Link2 size={14} />
        </ToolBtn>
        <ToolBtn onClick={() => imageInputRef.current?.click()} title="Chèn ảnh">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        </ToolBtn>
        <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
      </div>

      {/* Editor area */}
      <EditorContent editor={editor} />
    </div>
  );
}
