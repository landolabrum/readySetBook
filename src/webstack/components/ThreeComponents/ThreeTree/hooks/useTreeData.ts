import { useEffect, useState } from "react";
interface IUseTreeData{
    title?:string;
    data: any;
}
// d3 builds CSS selectors from node ids (e.g. `#link-${id}`), so ids must be
// selector-safe even when the source keys contain ".", "/", or spaces.
const safeId = (s: string) => String(s).replace(/[^a-zA-Z0-9_-]/g, '_');

const useTreeData = ({title,data}: IUseTreeData) =>{
  const [treeData, setTreeData] = useState<any>();
  useEffect(() => {
    const convertToTree = (obj: any, parentKey: string = title||'data'): any => {
      const children = Object.entries(obj)
        // Keys prefixed with `__` are node metadata (e.g. `__icon`), not real
        // children — they're lifted onto the parent field below, not rendered.
        .filter(([key]) => !key.startsWith('__'))
        .map(([key, value]: [string, any]) => {
        let field: any = { id: safeId(parentKey ? `${parentKey}-${key}` : key), name: key, value: null };
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          field.children = convertToTree(value, field.id).children;
          // Optional leading icon (inline SVG/HTML) carried on the value object.
          if (typeof value.__icon === 'string' && value.__icon) field.icon = value.__icon;
        } else if (Array.isArray(value)) {
          field.children = value.map((item, index) => {
            const itemIsDict = typeof item === 'object' && item !== null;
            return itemIsDict ? (
              convertToTree(item, `${field.id}-${index}`)
            ) : (
              { id: `${field.id}-${index}`, name: `${key}-${index}`, value: item }
            );
          });
        } else {
          field.value = value;
        }
        return field;
      });
      return { id: parentKey, name: parentKey, children: children };
    };

    if (data) {
      setTreeData({ name: title, children: convertToTree(data).children });
    }
  }, [data, open, title]);
  return {
    treeData
  }
};
export default useTreeData;