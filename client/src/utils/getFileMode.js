export const getFileMode = ({ selectedFile }) => {
  if (!selectedFile) return "javascript";

  const splitedArray = selectedFile.split(".");

  const extension = splitedArray[splitedArray.length - 1];

  switch (extension) {
    case "js":
      return "javascript";
    case "py":
      return "python";
    case "java":
      return "java";
    case "xml":
      return "xml";
    case "rb":
      return "ruby";
    case "sass":
      return "scss";
    case "md":
      return "markdown";
    case "sql":
      return "sql";
    case "json":
      return "json";
    case "html":
      return "html";
    case "hbs":
      return "handlebars";
    case "handlebars":
      return "handlebars";
    case "go":
      return "go";
    case "cs":
      return "csharp";
    case "litcoffee":
      return "coffeescript";
    case "css":
      return "css";
    default:
      return "plaintext";
  }
};
