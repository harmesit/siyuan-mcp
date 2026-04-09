/**
 * 导出所有工具处理器
 */

export { BaseToolHandler } from './base.js';

// 搜索相关
export * from './search.js';

// 文档相关
export * from './document.js';

// 笔记本相关
export * from './notebook.js';

// 快照相关
export * from './snapshot.js';

// 标签相关
export * from './tag.js';

import {
  UnifiedSearchHandler,
} from './search.js';
import {
  GetDocumentContentHandler,
  CreateDocumentHandler,
  AppendToDocumentHandler,
  UpdateDocumentHandler,
  ReplaceTextInBlockHandler,
  ReplaceTextInBlockStrictHandler,
  AppendToDailyNoteHandler,
  MoveDocumentsHandler,
  GetDocumentTreeHandler,
  GetBlockContextHandler,
  GetBlockHandler,
  GetChildBlocksHandler,
  SearchBlocksHandler,
  InsertBlockBeforeHandler,
  InsertBlockAfterHandler,
  AppendBlockHandler,
  PrependBlockHandler,
  DeleteBlockHandler,
  MoveBlockHandler,
  ReplaceRangeInBlockHandler,
  GetBlockAttributesHandler,
  SetBlockAttributesHandler,
  UpdateBlockAttributeHandler,
  ApplyOperationsHandler,
  GetBlockTreeSliceHandler,
  FindHeadingInTreeHandler,
  GetSectionByHeadingHandler,
  AppendBlockIfMissingHandler,
  SearchBlocksScopedHandler,
} from './document.js';
import {
  ListNotebooksHandler,
  GetRecentlyUpdatedDocumentsHandler,
  CreateNotebookHandler,
} from './notebook.js';
import {
  CreateSnapshotHandler,
  ListSnapshotsHandler,
  RollbackSnapshotHandler,
} from './snapshot.js';
import {
  ListAllTagsHandler,
  ReplaceTagHandler,
} from './tag.js';

// 工厂函数：创建所有处理器实例
export function createAllHandlers() {
  return [
    // 搜索
    new UnifiedSearchHandler(), // 统一搜索

    // 文档
    new GetDocumentContentHandler(),
    new CreateDocumentHandler(),
    new AppendToDocumentHandler(),
    new UpdateDocumentHandler(),
      
    new ReplaceTextInBlockHandler(),
    new ReplaceTextInBlockStrictHandler(),
      
    new GetBlockHandler(),
    new GetChildBlocksHandler(),
    new GetBlockContextHandler(),
    new GetBlockTreeSliceHandler(),
    new FindHeadingInTreeHandler(),
    new GetSectionByHeadingHandler(),
      
    new SearchBlocksHandler(),
      
    new InsertBlockBeforeHandler(),
    new InsertBlockAfterHandler(),
    new AppendBlockHandler(),
    new PrependBlockHandler(),
      
    new DeleteBlockHandler(),
    new MoveBlockHandler(),
      
    new ReplaceRangeInBlockHandler(),
      
    new GetBlockAttributesHandler(),
    new SetBlockAttributesHandler(),
    new UpdateBlockAttributeHandler(),
      
    new ApplyOperationsHandler(),
      
    new AppendToDailyNoteHandler(),
    new MoveDocumentsHandler(),
    new GetDocumentTreeHandler(),

    // 笔记本
    new ListNotebooksHandler(),
    new GetRecentlyUpdatedDocumentsHandler(),
    new CreateNotebookHandler(),
    new AppendBlockIfMissingHandler(),
    new SearchBlocksScopedHandler(),

    // 快照
    new CreateSnapshotHandler(),
    new ListSnapshotsHandler(),
    new RollbackSnapshotHandler(),

    // 标签
    new ListAllTagsHandler(),
    new ReplaceTagHandler(),
  ];
}
