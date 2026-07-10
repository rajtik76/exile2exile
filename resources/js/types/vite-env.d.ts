/// <reference types="vite/client" />

interface ImportMetaEnv {
    /** Overlay each passive-tree node's skill id for debugging. "true" to enable. */
    readonly VITE_DEBUG_TREE_IDS?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
