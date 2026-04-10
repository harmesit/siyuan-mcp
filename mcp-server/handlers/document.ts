/**
 * 文档相关工具处理器
 */

import { BaseToolHandler } from './base.js';
import type { ExecutionContext, JSONSchema } from '../core/types.js';
import type { DocTreeNodeResponse } from '../../src/types/index.js';

/**
 * 获取文档内容
 */
export class GetDocumentContentHandler extends BaseToolHandler<{ document_id: string; offset?: number; limit?: number }, string> {
  readonly name = 'get_document_content';
  readonly description =
  'Read markdown content of a note document, with optional line pagination. ' +
  'Use only when block, section, or tree tools are not sufficient. ' +
  'Prefer local or section-based tools for large documents to reduce token usage.';
  readonly inputSchema: JSONSchema = {
    type: 'object',
    properties: {
      document_id: {
        type: 'string',
        description: 'Target note document ID. Use when operating on a full note rather than a specific block.',
      },
      offset: {
        type: 'number',
        description: 'Starting line number, 0-based. Use for partial reads to reduce token usage. Default: 0.',
        default: 0,
      },
      limit: {
        type: 'number',
        description: 'Maximum number of lines to return. Omit to read from offset to the end.',
      },
    },
    required: ['document_id'],
  };

  async execute(args: any, context: ExecutionContext): Promise<string> {
    const fullContent = await context.siyuan.getFileContent(args.document_id);
    const lines = fullContent.split('\n');
    const totalLines = lines.length;

    if (args.offset === undefined && args.limit === undefined) {
      const metaInfo = `--- Document Info ---\nTotal Lines: ${totalLines}\n--- End Info ---\n\n`;
      return metaInfo + fullContent;
    }

    const offset = args.offset ?? 0;
    const startLine = offset;

    if (startLine >= totalLines) {
      return `--- Document Info ---\nTotal Lines: ${totalLines}\nRequested Range: ${startLine}-${startLine + (args.limit || 0)}\nStatus: Out of range\n--- End Info ---\n`;
    }

    const endLine = args.limit !== undefined ? startLine + args.limit : totalLines;
    const actualEndLine = Math.min(endLine, totalLines);

    const metaInfo = `--- Document Info ---\nTotal Lines: ${totalLines}\nCurrent Range: ${startLine}-${actualEndLine - 1} (showing ${actualEndLine - startLine} lines)\n--- End Info ---\n\n`;

    const selectedContent = lines.slice(startLine, actualEndLine).join('\n');
    return metaInfo + selectedContent;
  }
}

/**
 * 创建文档
 */
export class CreateDocumentHandler extends BaseToolHandler<
  { notebook_id: string; path: string; content: string },
  string
> {
  readonly name = 'create_document';
  readonly description =
  'Create a new note document in a SiYuan notebook with markdown content. ' +
  'Use when creating a new note, not when updating an existing one.';
  readonly inputSchema: JSONSchema = {
    type: 'object',
    properties: {
      notebook_id: {
        type: 'string',
        description: 'The target notebook ID where the note will be created',
      },
      path: {
        type: 'string',
        description: 'Note path within the notebook (e.g., /folder/note-title)',
      },
      content: {
        type: 'string',
        description: 'Markdown content for the new note',
      },
    },
    required: ['notebook_id', 'path', 'content'],
  };

  async execute(args: any, context: ExecutionContext): Promise<string> {
    return await context.siyuan.createFile(args.notebook_id, args.path, args.content);
  }
}

/**
 * 追加到文档
 */
export class AppendToDocumentHandler extends BaseToolHandler<
  { document_id: string; content: string },
  string
> {
  readonly name = 'append_to_document';
  readonly description =
  'Append markdown content to the end of an existing note document. ' +
  'Use only when appending at full-document level is intended. ' +
  'Prefer block append tools when targeting a specific section or subtree.';
  readonly inputSchema: JSONSchema = {
    type: 'object',
    properties: {
      document_id: {
        type: 'string',
        description: 'The target note document ID',
      },
      content: {
        type: 'string',
        description: 'Markdown content to append to the note',
      },
    },
    required: ['document_id', 'content'],
  };

  async execute(args: any, context: ExecutionContext): Promise<string> {
    return await context.siyuan.appendToFile(args.document_id, args.content);
  }
}

/**
 * 更新文档
 */
export class UpdateDocumentHandler extends BaseToolHandler<
  { document_id: string; content: string },
  { success: boolean; document_id: string }
> {
  readonly name = 'update_document';
  readonly description =
  'Replace the entire content of a note document with new markdown content. ' +
  'Use only when a full note rewrite is intended. ' +
  'Prefer block-level or range-level editing tools for localized changes.';
  readonly inputSchema: JSONSchema = {
    type: 'object',
    properties: {
      document_id: {
        type: 'string',
        description: 'The note document ID to update',
      },
      content: {
        type: 'string',
        description: 'New markdown content that will replace the existing note content',
      },
    },
    required: ['document_id', 'content'],
  };

  async execute(args: any, context: ExecutionContext): Promise<{ success: boolean; document_id: string }> {
    await context.siyuan.overwriteFile(args.document_id, args.content);
    return { success: true, document_id: args.document_id };
  }
}

/**
 * Replace text inside a single block
 */
export class ReplaceTextInBlockHandler extends BaseToolHandler<
  {
    block_id: string;
    find: string;
    replace: string;
    replace_all?: boolean;
  },
  {
    success: boolean;
    block_id: string;
    replacements: number;
    changed: boolean;
  }
> {
  readonly name = 'replace_text_in_block';

  readonly description =
  'Replace text inside a single SiYuan block. ' +
  'Use for localized edits when the target block is already known. ' +
  'Prefer this over rewriting the full document because it is safer and more token-efficient.';
  readonly inputSchema: JSONSchema = {
    type: 'object',
    properties: {
      block_id: {
        type: 'string',
        description: 'The target block ID',
      },
      find: {
        type: 'string',
        description: 'Exact text to search for inside the block',
      },
      replace: {
        type: 'string',
        description: 'Replacement text',
      },
      replace_all: {
        type: 'boolean',
        description: 'If true, replace all matches. Default: false',
        default: false,
      },
    },
    required: ['block_id', 'find', 'replace'],
  };

  async execute(
    args: {
      block_id: string;
      find: string;
      replace: string;
      replace_all?: boolean;
    },
    context: ExecutionContext
  ): Promise<{
    success: boolean;
    block_id: string;
    replacements: number;
    changed: boolean;
  }> {
    const result = await context.siyuan.block.replaceTextInBlock(
      args.block_id,
      args.find,
      args.replace,
      args.replace_all ?? false
    );

    return {
      success: result.success,
      block_id: result.blockId,
      replacements: result.replacements,
      changed: result.changed,
    };
  }
}

/**
 * Replace text inside a single block with optional strict context matching
 */
export class ReplaceTextInBlockStrictHandler extends BaseToolHandler<
  {
    block_id: string;
    find: string;
    replace: string;
    replace_all?: boolean;
    before_context?: string;
    after_context?: string;
    must_match_exactly_once?: boolean;
  },
  {
    success: boolean;
    block_id: string;
    replacements: number;
    changed: boolean;
    total_plain_matches: number;
    strict_matches: number;
    matched_ranges: Array<{ start: number; end: number }>;
    block_preview: string;
  }
> {
  readonly name = 'replace_text_in_block_strict';

  readonly description =
  'Strictly replace text inside a single block using exact match and optional surrounding context. ' +
  'Use when the exact existing text is already known and accidental edits must be avoided. ' +
  'Fails when no unique strict match is found.';
  readonly inputSchema: JSONSchema = {
    type: 'object',
    properties: {
      block_id: {
        type: 'string',
        description: 'The target block ID',
      },
      find: {
        type: 'string',
        description: 'Exact text to search for inside the block',
      },
      replace: {
        type: 'string',
        description: 'Replacement text',
      },
      replace_all: {
        type: 'boolean',
        description: 'If true, replace all strict matches',
        default: false,
      },
      before_context: {
        type: 'string',
        description: 'Optional exact text that must appear immediately before the match',
      },
      after_context: {
        type: 'string',
        description: 'Optional exact text that must appear immediately after the match',
      },
      must_match_exactly_once: {
        type: 'boolean',
        description: 'If true, fail unless exactly one strict match is found',
        default: true,
      },
    },
    required: ['block_id', 'find', 'replace'],
  };

  async execute(
    args: {
      block_id: string;
      find: string;
      replace: string;
      replace_all?: boolean;
      before_context?: string;
      after_context?: string;
      must_match_exactly_once?: boolean;
    },
    context: ExecutionContext
  ): Promise<{
    success: boolean;
    block_id: string;
    replacements: number;
    changed: boolean;
    total_plain_matches: number;
    strict_matches: number;
    matched_ranges: Array<{ start: number; end: number }>;
    block_preview: string;
  }> {
    const result = await context.siyuan.block.replaceTextInBlockStrict(
      args.block_id,
      args.find,
      args.replace,
      {
        replaceAll: args.replace_all ?? false,
        beforeContext: args.before_context,
        afterContext: args.after_context,
        mustMatchExactlyOnce: args.must_match_exactly_once ?? true,
      }
    );

    return {
      success: result.success,
      block_id: result.blockId,
      replacements: result.replacements,
      changed: result.changed,
      total_plain_matches: result.total_plain_matches,
      strict_matches: result.strict_matches,
      matched_ranges: result.matched_ranges,
      block_preview: result.block_preview,
    };
  }
}
/**
 * 获取单个块信息
 */
export class GetBlockHandler extends BaseToolHandler<
  { block_id: string },
  any
> {
  readonly name = 'get_block';

  readonly description =
  'Get raw data for a single SiYuan block by block ID. ' +
  'Use when an exact block is already known and raw metadata or content is needed. ' +
  'Prefer local navigation tools for exploration.';
  readonly inputSchema: JSONSchema = {
    type: 'object',
    properties: {
      block_id: {
        type: 'string',
        description: 'Target block ID',
      },
    },
    required: ['block_id'],
  };

  async execute(
    args: { block_id: string },
    context: ExecutionContext
  ): Promise<any> {
    return context.siyuan.block.getBlock(args.block_id);
  }
}

/**
 * 获取直接子块
 */
export class GetChildBlocksHandler extends BaseToolHandler<
  { block_id: string },
  any[]
> {
  readonly name = 'get_child_blocks';

  readonly description =
  'Get direct child blocks of a SiYuan block. ' +
  'Use for local navigation within a known subtree. ' +
  'Prefer this over broader tree or document reads when only immediate children are needed.';
  readonly inputSchema: JSONSchema = {
    type: 'object',
    properties: {
      block_id: {
        type: 'string',
        description: 'Parent block ID',
      },
    },
    required: ['block_id'],
  };

  async execute(
    args: { block_id: string },
    context: ExecutionContext
  ): Promise<any[]> {
    return context.siyuan.block.getChildBlocks(args.block_id);
  }
}

/**
 * 获取块上下文
 */
export class GetBlockContextHandler extends BaseToolHandler<
  {
    block_id: string;
    parents?: number;
    siblings_before?: number;
    siblings_after?: number;
    children?: number;
  },
  {
    target: any;
    parents: any[];
    siblings_before: any[];
    siblings_after: any[];
    children: any[];
  }
> {
  readonly name = 'get_block_context';

  readonly description =
  'Get compact local context around a known block, including nearby parents, siblings, and children. ' +
  'Use this before broader section or document reads to understand local structure with low token usage.';
  readonly inputSchema: JSONSchema = {
    type: 'object',
    properties: {
      block_id: {
        type: 'string',
        description: 'Target block ID',
      },
      parents: {
        type: 'number',
        description: 'How many parent levels to include',
        default: 1,
      },
      siblings_before: {
        type: 'number',
        description: 'How many previous sibling blocks to include',
        default: 1,
      },
      siblings_after: {
        type: 'number',
        description: 'How many following sibling blocks to include',
        default: 1,
      },
      children: {
        type: 'number',
        description: 'How many direct child blocks to include',
        default: 2,
      },
    },
    required: ['block_id'],
  };

  async execute(
    args: {
      block_id: string;
      parents?: number;
      siblings_before?: number;
      siblings_after?: number;
      children?: number;
    },
    context: ExecutionContext
  ): Promise<{
    target: any;
    parents: any[];
    siblings_before: any[];
    siblings_after: any[];
    children: any[];
  }> {
    return context.siyuan.block.getBlockContext(args.block_id, {
      parents: args.parents,
      siblingsBefore: args.siblings_before,
      siblingsAfter: args.siblings_after,
      children: args.children,
    });
  }
}

/**
 * 搜索块
 */
export class SearchBlocksHandler extends BaseToolHandler<
  { query: string; limit?: number },
  Array<{
    block_id: string;
    parent_id?: string;
    root_id?: string;
    type?: string;
    hpath?: string;
    snippet: string;
    updated?: string;
  }>
> {
  readonly name = 'search_blocks';

  readonly description =
  'Search blocks globally and return compact low-token matches. ' +
  'Use when the target block is unknown and subtree scope is not known. ' +
  'Prefer scoped search when a root_id or parent_id is already known. ' +
  'Returns compact snippets and block metadata, not full content.';
  readonly inputSchema: JSONSchema = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results',
        default: 10,
      },
    },
    required: ['query'],
  };

  async execute(
    args: { query: string; limit?: number },
    context: ExecutionContext
  ): Promise<
    Array<{
      block_id: string;
      parent_id?: string;
      root_id?: string;
      type?: string;
      hpath?: string;
      snippet: string;
      updated?: string;
    }>
  > {
    return context.siyuan.block.searchBlocks(args.query, args.limit ?? 10);
  }
}

/**
 * 在指定块之前插入块
 */
export class InsertBlockBeforeHandler extends BaseToolHandler<
  { target_block_id: string; markdown: string },
  string
> {
  readonly name = 'insert_block_before';

  readonly description =
    'Insert a new block before a target block.';

  readonly inputSchema: JSONSchema = {
    type: 'object',
    properties: {
      target_block_id: {
        type: 'string',
        description: 'Target block ID',
      },
      markdown: {
        type: 'string',
        description: 'Markdown content for the new block',
      },
    },
    required: ['target_block_id', 'markdown'],
  };

  async execute(
    args: { target_block_id: string; markdown: string },
    context: ExecutionContext
  ): Promise<string> {
    return context.siyuan.block.insertBlockBefore(
      args.target_block_id,
      args.markdown
    );
  }
}

/**
 * 在指定块之后插入块
 */
export class InsertBlockAfterHandler extends BaseToolHandler<
  { target_block_id: string; markdown: string },
  string
> {
  readonly name = 'insert_block_after';

  readonly description =
    'Insert a new block after a target block.';

  readonly inputSchema: JSONSchema = {
    type: 'object',
    properties: {
      target_block_id: {
        type: 'string',
        description: 'Target block ID',
      },
      markdown: {
        type: 'string',
        description: 'Markdown content for the new block',
      },
    },
    required: ['target_block_id', 'markdown'],
  };

  async execute(
    args: { target_block_id: string; markdown: string },
    context: ExecutionContext
  ): Promise<string> {
    return context.siyuan.block.insertBlockAfter(
      args.target_block_id,
      args.markdown
    );
  }
}

/**
 * 追加子块
 */
export class AppendBlockHandler extends BaseToolHandler<
  { parent_block_id: string; markdown: string },
  string
> {
  readonly name = 'append_block';

  readonly description =
  'Append a new child block under a parent block. ' +
  'Use when the target parent is already known and duplicate creation is not a concern. ' +
  'Prefer append_block_if_missing for retry-safe appends.';
  readonly inputSchema: JSONSchema = {
    type: 'object',
    properties: {
      parent_block_id: {
        type: 'string',
        description: 'Parent block ID',
      },
      markdown: {
        type: 'string',
        description: 'Markdown content for the new child block',
      },
    },
    required: ['parent_block_id', 'markdown'],
  };

  async execute(
    args: { parent_block_id: string; markdown: string },
    context: ExecutionContext
  ): Promise<string> {
    return context.siyuan.block.appendBlock(
      args.parent_block_id,
      args.markdown
    );
  }
}

/**
 * 前插子块
 */
export class PrependBlockHandler extends BaseToolHandler<
  { parent_block_id: string; markdown: string },
  string
> {
  readonly name = 'prepend_block';

  readonly description =
    'Prepend a child block to a parent block.';

  readonly inputSchema: JSONSchema = {
    type: 'object',
    properties: {
      parent_block_id: {
        type: 'string',
        description: 'Parent block ID',
      },
      markdown: {
        type: 'string',
        description: 'Markdown content for the new child block',
      },
    },
    required: ['parent_block_id', 'markdown'],
  };

  async execute(
    args: { parent_block_id: string; markdown: string },
    context: ExecutionContext
  ): Promise<string> {
    return context.siyuan.block.prependBlock(
      args.parent_block_id,
      args.markdown
    );
  }
}

/**
 * 删除块
 */
export class DeleteBlockHandler extends BaseToolHandler<
  { block_id: string },
  { success: boolean; block_id: string }
> {
  readonly name = 'delete_block';

  readonly description =
    'Delete a block by ID.';

  readonly inputSchema: JSONSchema = {
    type: 'object',
    properties: {
      block_id: {
        type: 'string',
        description: 'Block ID',
      },
    },
    required: ['block_id'],
  };

  async execute(
    args: { block_id: string },
    context: ExecutionContext
  ): Promise<{ success: boolean; block_id: string }> {
    await context.siyuan.block.deleteBlock(args.block_id);
    return { success: true, block_id: args.block_id };
  }
}

/**
 * 移动块
 */
export class MoveBlockHandler extends BaseToolHandler<
  { block_id: string; parent_id?: string; previous_id?: string },
  { success: boolean; block_id: string }
> {
  readonly name = 'move_block';

  readonly description =
  'Move a block relative to another block or parent location. ' +
  'Use for structural reorganization when the involved block IDs are already known.';
  readonly inputSchema: JSONSchema = {
    type: 'object',
    properties: {
      block_id: {
        type: 'string',
        description: 'Block ID to move',
      },
      parent_id: {
        type: 'string',
        description: 'New parent block ID',
      },
      previous_id: {
        type: 'string',
        description: 'Place after this sibling block ID',
      },
    },
    required: ['block_id'],
  };

  async execute(
    args: { block_id: string; parent_id?: string; previous_id?: string },
    context: ExecutionContext
  ): Promise<{ success: boolean; block_id: string }> {
    await context.siyuan.block.moveBlock(
      args.block_id,
      args.previous_id,
      args.parent_id
    );

    return { success: true, block_id: args.block_id };
  }
}

/**
 * 替换块内范围
 */
export class ReplaceRangeInBlockHandler extends BaseToolHandler<
  { block_id: string; start: number; end: number; replacement: string },
  { success: boolean; blockId: string; changed: boolean }
> {
  readonly name = 'replace_range_in_block';

  readonly description =
    'Replace a character range inside a single block.';

  readonly inputSchema: JSONSchema = {
    type: 'object',
    properties: {
      block_id: {
        type: 'string',
        description: 'Block ID',
      },
      start: {
        type: 'number',
        description: 'Start index',
      },
      end: {
        type: 'number',
        description: 'End index',
      },
      replacement: {
        type: 'string',
        description: 'Replacement text',
      },
    },
    required: ['block_id', 'start', 'end', 'replacement'],
  };

  async execute(
    args: { block_id: string; start: number; end: number; replacement: string },
    context: ExecutionContext
  ): Promise<{ success: boolean; blockId: string; changed: boolean }> {
    return context.siyuan.block.replaceRangeInBlock(
      args.block_id,
      args.start,
      args.end,
      args.replacement
    );
  }
}

/**
 * 获取块属性
 */
export class GetBlockAttributesHandler extends BaseToolHandler<
  { block_id: string },
  Record<string, string>
> {
  readonly name = 'get_block_attributes';

  readonly description =
    'Get all attributes of a block.';

  readonly inputSchema: JSONSchema = {
    type: 'object',
    properties: {
      block_id: {
        type: 'string',
        description: 'Block ID',
      },
    },
    required: ['block_id'],
  };

  async execute(
    args: { block_id: string },
    context: ExecutionContext
  ): Promise<Record<string, string>> {
    return context.siyuan.block.getBlockAttributes(args.block_id);
  }
}

/**
 * 设置块属性
 */
export class SetBlockAttributesHandler extends BaseToolHandler<
  { block_id: string; attrs: Record<string, string> },
  { success: boolean; block_id: string }
> {
  readonly name = 'set_block_attributes';

  readonly description =
    'Set multiple attributes on a block.';

  readonly inputSchema: JSONSchema = {
    type: 'object',
    properties: {
      block_id: {
        type: 'string',
        description: 'Block ID',
      },
      attrs: {
        type: 'object',
        description: 'Attributes object',
        additionalProperties: {
          type: 'string',
        },
      },
    },
    required: ['block_id', 'attrs'],
  };

  async execute(
    args: { block_id: string; attrs: Record<string, string> },
    context: ExecutionContext
  ): Promise<{ success: boolean; block_id: string }> {
    await context.siyuan.block.setBlockAttributes(args.block_id, args.attrs);
    return { success: true, block_id: args.block_id };
  }
}

/**
 * 更新单个块属性
 */
export class UpdateBlockAttributeHandler extends BaseToolHandler<
  { block_id: string; key: string; value: string },
  { success: boolean; block_id: string; key: string }
> {
  readonly name = 'update_block_attribute';

  readonly description =
    'Update one attribute on a block.';

  readonly inputSchema: JSONSchema = {
    type: 'object',
    properties: {
      block_id: {
        type: 'string',
        description: 'Block ID',
      },
      key: {
        type: 'string',
        description: 'Attribute key',
      },
      value: {
        type: 'string',
        description: 'Attribute value',
      },
    },
    required: ['block_id', 'key', 'value'],
  };

  async execute(
    args: { block_id: string; key: string; value: string },
    context: ExecutionContext
  ): Promise<{ success: boolean; block_id: string; key: string }> {
    await context.siyuan.block.updateBlockAttribute(
      args.block_id,
      args.key,
      args.value
    );

    return { success: true, block_id: args.block_id, key: args.key };
  }
}

/**
 * 批量应用操作
 */
export class ApplyOperationsHandler extends BaseToolHandler<
  {
    operations: Array<
      | { op: 'insert_before'; target_block_id: string; markdown: string }
      | { op: 'insert_after'; target_block_id: string; markdown: string }
      | { op: 'append'; parent_block_id: string; markdown: string }
      | { op: 'prepend'; parent_block_id: string; markdown: string }
      | { op: 'delete'; block_id: string }
      | { op: 'move'; block_id: string; parent_id?: string; previous_id?: string }
      | { op: 'replace_range'; block_id: string; start: number; end: number; replacement: string }
      | { op: 'set_attr'; block_id: string; key: string; value: string }
    >;
  },
  any[]
> {
  readonly name = 'apply_operations';

  readonly description =
  'Apply multiple block edit or structural operations in one call. ' +
  'Use when several related changes should succeed together with lower token overhead. ' +
  'Prefer this over many separate mutation calls when editing the same local area.';
  readonly inputSchema: JSONSchema = {
    type: 'object',
    properties: {
      operations: {
        type: 'array',
        description: 'List of operations',
        items: {
          type: 'object',
        },
      },
    },
    required: ['operations'],
  };

  async execute(
    args: {
      operations: Array<
        | { op: 'insert_before'; target_block_id: string; markdown: string }
        | { op: 'insert_after'; target_block_id: string; markdown: string }
        | { op: 'append'; parent_block_id: string; markdown: string }
        | { op: 'prepend'; parent_block_id: string; markdown: string }
        | { op: 'delete'; block_id: string }
        | { op: 'move'; block_id: string; parent_id?: string; previous_id?: string }
        | { op: 'replace_range'; block_id: string; start: number; end: number; replacement: string }
        | { op: 'set_attr'; block_id: string; key: string; value: string }
      >;
    },
    context: ExecutionContext
  ): Promise<any[]> {
    return context.siyuan.block.applyOperations(args.operations);
  }
}

/**
 * 追加到今日笔记
 */
export class AppendToDailyNoteHandler extends BaseToolHandler<
  { notebook_id: string; content: string },
  string
> {
  readonly name = 'append_to_daily_note';
  readonly description = "Append markdown content to today's daily note in SiYuan (automatically creates the daily note if it doesn't exist)";
  readonly inputSchema: JSONSchema = {
    type: 'object',
    properties: {
      notebook_id: {
        type: 'string',
        description: 'The notebook ID where the daily note resides',
      },
      content: {
        type: 'string',
        description: 'Markdown content to append to today\'s daily note',
      },
    },
    required: ['notebook_id', 'content'],
  };

  async execute(args: any, context: ExecutionContext): Promise<string> {
    return await context.siyuan.appendToDailyNote(args.notebook_id, args.content);
  }
}

/**
 * 移动文档（通过ID）
 */
export class MoveDocumentsHandler extends BaseToolHandler<
  { from_ids: string | string[]; to_parent_id?: string; to_notebook_root?: string },
  { success: boolean; moved_count: number; from_ids: string[]; to_parent_id?: string; to_notebook_root?: string }
> {
  readonly name = 'move_documents';
  readonly description = 'Move one or more notes to a new location in SiYuan. Provide EXACTLY ONE destination: either to_parent_id (to nest notes under a parent note) OR to_notebook_root (to move notes to notebook top level).';
  readonly inputSchema: JSONSchema = {
    type: 'object',
    properties: {
      from_ids: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of note document IDs to move. For a single note, use an array with one element: ["note-id"]',
      },
      to_parent_id: {
        type: 'string',
        description: 'OPTION 1: Parent note document ID. Notes will be nested under this parent note as children. Cannot be used together with to_notebook_root.',
      },
      to_notebook_root: {
        type: 'string',
        description: 'OPTION 2: Notebook ID. Notes will be moved to the top level of this notebook. Cannot be used together with to_parent_id.',
      },
    },
    required: ['from_ids'],
  };

  async execute(args: any, context: ExecutionContext): Promise<{ success: boolean; moved_count: number; from_ids: string[]; to_parent_id?: string; to_notebook_root?: string }> {
    let fromIds: string[];

    if (Array.isArray(args.from_ids)) {
      fromIds = args.from_ids;
    } else if (typeof args.from_ids === 'string') {
      if (args.from_ids.startsWith('[')) {
        try {
          fromIds = JSON.parse(args.from_ids);
        } catch {
          fromIds = [args.from_ids];
        }
      } else {
        fromIds = [args.from_ids];
      }
    } else {
      throw new Error('from_ids must be a string or array of strings');
    }

    const hasParentId = !!args.to_parent_id;
    const hasNotebookRoot = !!args.to_notebook_root;

    if (!hasParentId && !hasNotebookRoot) {
      throw new Error('Must provide exactly one of: to_parent_id (for nested placement) or to_notebook_root (for root placement)');
    }

    if (hasParentId && hasNotebookRoot) {
      throw new Error('Cannot provide both to_parent_id and to_notebook_root - choose only one target location');
    }

    if (hasParentId) {
      await context.siyuan.document.moveDocumentsByIds(fromIds, args.to_parent_id);
    } else {
      await context.siyuan.document.moveDocumentsToNotebookRoot(fromIds, args.to_notebook_root);
    }

    return {
      success: true,
      moved_count: fromIds.length,
      from_ids: fromIds,
      to_parent_id: args.to_parent_id,
      to_notebook_root: args.to_notebook_root
    };
  }
}

/**
 * 获取文档树
 */
export class GetDocumentTreeHandler extends BaseToolHandler<
  { id: string; depth?: number },
  DocTreeNodeResponse[]
> {
  readonly name = 'get_document_tree';
  readonly description = 'Get the hierarchical structure of notes in SiYuan with specified depth. Returns the note tree starting from a notebook or parent note.';
  readonly inputSchema: JSONSchema = {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Starting point: note document ID or notebook ID',
      },
      depth: {
        type: 'number',
        description: 'How deep to traverse the note hierarchy (1 = direct children only, 2 = children and grandchildren, etc.). Default is 1.',
        default: 1,
      },
    },
    required: ['id'],
  };

  async execute(args: any, context: ExecutionContext): Promise<DocTreeNodeResponse[]> {
    const depth = args.depth || 1;
    return await context.siyuan.document.getDocumentTree(args.id, depth);
  }
}

/**
 * Get a compact subtree slice for one block
 */
export class GetBlockTreeSliceHandler extends BaseToolHandler<
  { block_id: string; depth?: number },
  any
> {
  readonly name = 'get_block_tree_slice';

  readonly description =
  'Get a bounded subtree slice starting from a known block. ' +
  'Use when structure matters more than full content. ' +
  'Prefer this over broad document reads when navigating deep hierarchies.';
  readonly inputSchema: JSONSchema = {
    type: 'object',
    properties: {
      block_id: {
        type: 'string',
        description: 'Root block ID for the subtree slice',
      },
      depth: {
        type: 'number',
        description: 'How many child levels to include',
        default: 2,
      },
    },
    required: ['block_id'],
  };

  async execute(
    args: { block_id: string; depth?: number },
    context: ExecutionContext
  ): Promise<any> {
    return context.siyuan.block.getBlockTreeSlice(
      args.block_id,
      args.depth ?? 2
    );
  }
}

/**
 * Find heading-like blocks within a local subtree
 */
export class FindHeadingInTreeHandler extends BaseToolHandler<
  { block_id: string; heading_query: string; depth?: number },
  any[]
> {
  readonly name = 'find_heading_in_tree';

  readonly description =
  'Find a heading within a known document or block tree. ' +
  'Use when the document is known but the exact section block is not. ' +
  'Prefer this before reading large documents or broad block ranges.';
  readonly inputSchema: JSONSchema = {
    type: 'object',
    properties: {
      block_id: {
        type: 'string',
        description: 'Root block ID for subtree search',
      },
      heading_query: {
        type: 'string',
        description: 'Heading text to search for',
      },
      depth: {
        type: 'number',
        description: 'How many child levels to inspect',
        default: 4,
      },
    },
    required: ['block_id', 'heading_query'],
  };

  async execute(
    args: { block_id: string; heading_query: string; depth?: number },
    context: ExecutionContext
  ): Promise<any[]> {
    return context.siyuan.block.findHeadingInTree(
      args.block_id,
      args.heading_query,
      args.depth ?? 4
    );
  }
}

/**
 * Get section blocks starting from a heading
 */
export class GetSectionByHeadingHandler extends BaseToolHandler<
  { block_id: string; heading_query: string },
  {
    heading: any;
    section_blocks: any[];
  }
> {
  readonly name = 'get_section_by_heading';

  readonly description =
  'Get the content under a heading within a known tree or document. ' +
  'Use to read only the relevant section of a large note. ' +
  'Prefer this over full document reads when the target heading is known.';
  readonly inputSchema: JSONSchema = {
    type: 'object',
    properties: {
      block_id: {
        type: 'string',
        description: 'Root block ID for local heading search',
      },
      heading_query: {
        type: 'string',
        description: 'Heading text to match',
      },
    },
    required: ['block_id', 'heading_query'],
  };

  async execute(
    args: { block_id: string; heading_query: string },
    context: ExecutionContext
  ): Promise<{
    heading: any;
    section_blocks: any[];
  }> {
    return context.siyuan.block.getSectionByHeading(
      args.block_id,
      args.heading_query
    );
  }
}

function unwrapBlock(value: any): any | null {
  if (!value) return null;

  if (Array.isArray(value)) {
    return value.length > 0 ? unwrapBlock(value[0]) : null;
  }

  if (typeof value === 'object') {
    if (value.id) return value;
    if (value.block) return unwrapBlock(value.block);
    if (value.data) return unwrapBlock(value.data);
  }

  return null;
}

function unwrapBlocks(value: any): any[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      const block = unwrapBlock(item);
      return block ? [block] : [];
    });
  }

  if (typeof value === 'object' && Array.isArray(value.data)) {
    return value.data.flatMap((item: any) => {
      const block = unwrapBlock(item);
      return block ? [block] : [];
    });
  }

  const single = unwrapBlock(value);
  return single ? [single] : [];
}

function blockText(block: any): string {
  const b = unwrapBlock(block) ?? block;

  return String(
    b?.content ??
    b?.markdown ??
    b?.fcontent ??
    b?.name ??
    b?.text ??
    ''
  ).trim();
}

function norm(s: string): string {
  return String(s ?? '').replace(/\r\n/g, '\n').trim();
}

function matchesBlock(block: any, content: string, exact = true): boolean {
  const a = blockText(block);
  const b = norm(content);
  if (!a || !b) return false;
  return exact ? norm(a) === b : norm(a).includes(b);
}

function makeSnippet(text: string, query: string, max = 160): string {
  const t = norm(text);
  if (!t) return '';
  const q = norm(query).toLowerCase();
  const i = t.toLowerCase().indexOf(q);
  if (i < 0) return t.length <= max ? t : `${t.slice(0, max - 3)}...`;
  const start = Math.max(0, i - Math.floor(max / 3));
  const end = Math.min(t.length, start + max);
  return `${start > 0 ? '...' : ''}${t.slice(start, end)}${end < t.length ? '...' : ''}`;
}

/**
 * Retry-safe append: only append if matching child block does not already exist
 */
export class AppendBlockIfMissingHandler extends BaseToolHandler<
  {
    parent_id: string;
    content: string;
    exact_match?: boolean;
    dry_run?: boolean;
  },
  {
    success: boolean;
    created: boolean;
    block_id?: string;
    message: string;
    error_code?: 'BLOCK_NOT_FOUND' | 'ALREADY_EXISTS';
  }
> {
  readonly name = 'append_block_if_missing';

  readonly description =
    'Append a new child block only if matching content is not already present under the parent block. ' +
    'Use for retry-safe appends, logs, and repeated automation runs where duplicate content must be avoided. ' +
    'Returns ALREADY_EXISTS instead of creating a duplicate block.';

  readonly inputSchema: JSONSchema = {
    type: 'object',
    properties: {
      parent_id: {
        type: 'string',
        description: 'Parent block ID. The new child block will be appended here.',
      },
      content: {
        type: 'string',
        description: 'Markdown content for the child block to append.',
      },
      exact_match: {
        type: 'boolean',
        description:
          'If true, require normalized exact match against existing direct child content. Default: true.',
        default: true,
      },
      dry_run: {
        type: 'boolean',
        description:
          'If true, report whether a new block would be created without changing content. Default: false.',
        default: false,
      },
    },
    required: ['parent_id', 'content'],
  };

  async execute(
    args: {
      parent_id: string;
      content: string;
      exact_match?: boolean;
      dry_run?: boolean;
    },
    context: ExecutionContext
  ): Promise<{
    success: boolean;
    created: boolean;
    block_id?: string;
    message: string;
    error_code?: 'BLOCK_NOT_FOUND' | 'ALREADY_EXISTS';
  }> {
    const parent = unwrapBlock(await context.siyuan.block.getBlock(args.parent_id));
    if (!parent) {
      return {
        success: false,
        created: false,
        message: `Parent block not found: ${args.parent_id}`,
        error_code: 'BLOCK_NOT_FOUND',
      };
    }

    const children = unwrapBlocks(await context.siyuan.block.getChildBlocks(args.parent_id));
    const existing = children.find((b: any) => matchesBlock(b, args.content, args.exact_match ?? true));

    if (existing) {
      return {
        success: true,
        created: false,
        block_id: existing.id,
        message: 'Matching child block already exists',
        error_code: 'ALREADY_EXISTS',
      };
    }

    if (args.dry_run ?? false) {
      return {
        success: true,
        created: false,
        message: 'No matching child block found; append would create a new block',
      };
    }

    const block_id = await context.siyuan.block.appendBlock(args.parent_id, args.content);

    return {
      success: true,
      created: true,
      block_id,
      message: 'Block appended',
    };
  }
}

/**
 * Scoped block search: subtree search when root_id or parent_id is provided, global otherwise
 */
export class SearchBlocksScopedHandler extends BaseToolHandler<
  {
    query: string;
    root_id?: string;
    parent_id?: string;
    limit?: number;
  },
  {
    success: boolean;
    scope_used: 'global' | 'subtree';
    items: Array<{
      id: string;
      content_snippet: string;
      parent_id?: string;
      path?: string;
    }>;
    count: number;
    message: string;
  }
> {
  readonly name = 'search_blocks_scoped';

  readonly description =
    'Search blocks globally, or narrow results using a known scope block when root_id or parent_id is provided. ' +
    'Use this when a likely scope block is known and you want fewer, more relevant matches. ' +
    'Returns compact matches with snippets and path information when available.';
  readonly inputSchema: JSONSchema = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search text to match against block content.',
      },
      root_id: {
        type: 'string',
        description: 'Restrict search to this subtree root BLOCK ID only. Mutually exclusive with parent_id.',
      },
      parent_id: {
        type: 'string',
        description: 'Restrict search to this parent BLOCK ID only. Mutually exclusive with root_id.',
      },
      limit: {
        type: 'number',
        description:
          'Maximum number of matches to return. Keep small for lower token usage. Default: 10.',
        default: 10,
      },
    },
    required: ['query'],
  };

  validate(args: any): args is {
    query: string;
    root_id?: string;
    parent_id?: string;
    limit?: number;
  } {
    super.validate(args);
    this.forbidTogether(args, ['root_id', 'parent_id']);
    if (args.limit !== undefined) {
      this.getNumberInRange(args.limit, 'limit', { min: 1, max: 100 });
    }
    return true;
  }

  async execute(
    args: {
      query: string;
      root_id?: string;
      parent_id?: string;
      limit?: number;
    },
    context: ExecutionContext
  ): Promise<{
    success: boolean;
    scope_used: 'global' | 'subtree';
    items: Array<{
      id: string;
      content_snippet: string;
      parent_id?: string;
      path?: string;
    }>;
    count: number;
    message: string;
  }> {
    const limit = args.limit ?? 10;
    const scopeId = args.root_id ?? args.parent_id;

    // No scope -> regular global search
    if (!scopeId) {
      const results = await context.siyuan.block.searchBlocks(args.query, limit);
      const items = (results ?? []).slice(0, limit).map((b: any) => ({
        id: b.block_id ?? b.id,
        content_snippet: b.snippet ?? makeSnippet(blockText(b), args.query),
        parent_id: b.parent_id,
        path: b.hpath,
      }));

      return {
        success: true,
        scope_used: 'global',
        items,
        count: items.length,
        message: `Found ${items.length} matching block(s) using global search`,
      };
    }

    // Scoped mode: use global search first, then filter candidates by ancestry.
    // This avoids depending on getBlock(scopeId), which may fail even for valid block IDs.
    const candidateLimit = Math.max(limit * 10, 50);
    const results = await context.siyuan.block.searchBlocks(args.query, candidateLimit);

    const matched: Array<{
      id: string;
      content_snippet: string;
      parent_id?: string;
      path?: string;
    }> = [];

    for (const raw of results ?? []) {
      if (matched.length >= limit) break;

      const blockId = raw.block_id;
      if (!blockId) continue;

      // Fast metadata checks first
      if (blockId === scopeId || raw.parent_id === scopeId || raw.root_id === scopeId) {
        matched.push({
          id: blockId,
          content_snippet: raw.snippet ?? makeSnippet(blockText(raw), args.query),
          parent_id: raw.parent_id,
          path: raw.hpath,
        });
        continue;
      }

      // Fallback: inspect parent chain via block context
      try {
        const ctx = await context.siyuan.block.getBlockContext(blockId, {
          parents: 20,
          siblingsBefore: 0,
          siblingsAfter: 0,
          children: 0,
        });

        const parents = Array.isArray(ctx?.parents) ? ctx.parents : [];
        const parentIds = parents
          .map((p: any) => unwrapBlock(p))
          .filter((p: any) => !!p?.id)
          .map((p: any) => p.id);

        if (parentIds.includes(scopeId)) {
          matched.push({
            id: blockId,
            content_snippet: raw.snippet ?? makeSnippet(blockText(raw), args.query),
            parent_id: raw.parent_id,
            path: raw.hpath,
          });
        }
      } catch {
        // Ignore per-result ancestry lookup failures and continue
      }
    }

    return {
      success: true,
      scope_used: 'subtree',
      items: matched,
      count: matched.length,
      message:
        matched.length > 0
          ? `Found ${matched.length} matching block(s) within scoped subtree`
          : `Found 0 matching block(s) within scoped subtree`,
    };
  }
}