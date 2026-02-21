import { getMdxComponentCss } from "./component-style-registry";

type MdxComponentStylesProps = {
  components?: string[];
};

export default function MdxComponentStyles({ components }: MdxComponentStylesProps) {
  const css = getMdxComponentCss(components);
  if (!css) {
    return null;
  }

  return (
    <style
      data-typematter-mdx-styles
      dangerouslySetInnerHTML={{ __html: css }}
    />
  );
}
