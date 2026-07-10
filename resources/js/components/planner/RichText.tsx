import Markdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import RefChip from '@/components/planner/RefChip';
import { remarkRefTokens } from '@/lib/planReferences';

// Raw HTML is not rendered by react-markdown unless rehype-raw is added - we don't,
// so author Markdown stays safe. Links open in a new tab with noopener/nofollow.
const components = {
    'ref-chip': RefChip,
    a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="text-[#ecd49a] underline decoration-[#c9a24a]/40 underline-offset-2 hover:decoration-[#c9a24a]"
        >
            {children}
        </a>
    ),
} as unknown as Components;

const plugins = [remarkGfm, remarkRefTokens];

/**
 * Renders a plan's Markdown text (build description or a section's notes) with GFM
 * support and inline reference chips. Returns nothing for empty text.
 */
export default function RichText({ text }: { text: string }) {
    if (!text || text.trim() === '') {
        return null;
    }

    return (
        <div className="planner-md">
            <Markdown remarkPlugins={plugins} components={components}>
                {text}
            </Markdown>
        </div>
    );
}
