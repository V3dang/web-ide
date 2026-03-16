import { useState } from "react";

const FileTreeNode = ({ fileName, nodes, onSelect, path }) => {
  const isDir = !!nodes;
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="tree-node">
      <button
        type="button"
        className={`tree-item ${isDir ? "folder-item" : "file-node"}`}
        onClick={(e) => {
          e.stopPropagation();
          if (isDir) {
            setExpanded((prev) => !prev);
            return;
          }
          onSelect(path);
        }}
      >
        <span className="tree-prefix">{isDir ? (expanded ? "▾" : "▸") : "•"}</span>
        <span>{fileName}</span>
      </button>

      {nodes && fileName !== "node_modules" && expanded && (
        <div className="tree-children">
          {Object.keys(nodes).map((child) => (
            <FileTreeNode
              key={child}
              onSelect={onSelect}
              path={path + "/" + child}
              fileName={child}
              nodes={nodes[child]}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const FileTree = ({ tree, onSelect }) => {
  return <FileTreeNode onSelect={onSelect} fileName="workspace" path="" nodes={tree} />;
};
export default FileTree;
