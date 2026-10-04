import { useState } from 'react';
import { MarkdownEditor } from 'realm-of-aethelraed';
import { noop } from '../preview-helpers';

const draft = 'Aldric raised the ember-sigil shield. "**Hold the line**," he called, *and they did.* We fall back to [[Emberfall Keep]] at dawn.';
const box = (children: React.ReactNode) => <div className="w-[640px] p-4 bg-ink-950">{children}</div>;

const Editor = (props: { initial?: string; isSubmitting?: boolean; disabled?: boolean }) => {
  const [value, setValue] = useState(props.initial ?? '');
  return (
    <MarkdownEditor value={value} onChange={setValue} onPost={noop} submitLabel="Post Reply"
      isSubmitting={props.isSubmitting} disabled={props.disabled} placeholder="Reply as Aldric Vane..." />
  );
};

export const Empty = () => box(<Editor />);
export const WithDraft = () => box(<Editor initial={draft} />);
export const Posting = () => box(<Editor initial={draft} isSubmitting />);
export const Disabled = () => box(<Editor disabled />);
