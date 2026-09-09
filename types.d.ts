// /home/web/MindBurner/webapp/types.d.ts

declare module "*.css" {
  const css: string;
  export default css;
}

declare module "*.scss" {
  const css: Object<any>;
  export default css;
}

type CompiledCss = string & { __hash?: string };