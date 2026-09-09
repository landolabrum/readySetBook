import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import styles from './UiMarkDown.scss';

import { interpolateTemplate } from '../functions/interpolateTemplate';
import {
  injectShorthandIcons,
  injectShorthandQr,
  injectIconTags,
  injectQrTags,
} from '../functions/injectTokens';
import SpanRenderer from '../views/SpanRenderer';

export interface UiMarkdownProps {
  /** Raw markdown text that may include placeholders like {{name}} or {{user.first}} */
  text: string;
  /** Optional text color */
  color?: string;
  /** Optional class name */
  jsxClass?: string;
  /** Variables to interpolate into the markdown */
  variables?: Record<string, unknown>;
  /**
   * If true, unknown variables are replaced with an empty string.
   * If false (default), unknown variables are left as-is, e.g. {{missing}}.
   */
  strict?: boolean;
  /**
   * Custom delimiters if you don't want {{ }}. Example: ['${', '}'] -> ${name}
   */
  delimiters?: [string, string];
}

export interface UiMarkdownLabel {
  label: UiMarkdownProps;
}


const UiMarkdown: React.FC<UiMarkdownProps> = ({
  text,
  color,
  jsxClass,
  variables,
  strict,
  delimiters
}) => {
  const plug: any = rehypeRaw;

  // 1) Interpolate {{variables}}
  const processedText = useMemo(
    () => interpolateTemplate(text ?? '', variables ?? {}, { strict, delimiters }),
    [text, variables, strict, delimiters]
  );

  // 2) Inject token spans (icons, QR codes, shorthands)
  const withTokens = useMemo(
    () => injectShorthandQr(injectShorthandIcons(injectQrTags(injectIconTags(processedText)))),
    [processedText]
  );

  return (
    <>
      <ReactMarkdown
        rehypePlugins={[plug]}
        components={{
          span: SpanRenderer,
          p: ({ node, ...props }: any) => {
            // original behavior: wrap HTML child tag names only; leave React components intact
            const children = React.Children.map(props?.children as any, (child: any, key: number) => {
              if (!child || !React.isValidElement(child)) return child;
              // Preserve our special span tokens
              if (typeof child.type === 'string') {
                const childProps: any = (child as any).props || {};
                if (child.type.toLowerCase() === 'span' && (childProps['data-uicon'] || childProps.dataUicon || childProps['data-qr'] || childProps.dataQr)) return child;
                const TagName: any = child.type as any;
                return (
                  <React.Fragment key={key}>
                    <style jsx>{styles}</style>
                    <span>
                      <TagName>{(child.props as any)?.children?.[0]}</TagName>
                    </span>
                  </React.Fragment>
                );
              }
              // Non-string element (React component) — return unchanged
              return child;
            });
            const { children: _omit, ...rest } = (props || {}) as any;
            return (
              <div
                className={`ui-mark-down ${jsxClass ?? ''}`}
                style={{ color }}
                {...rest}
              >
                {children}
              </div>
            );
          }
        } as any}
      >
        {withTokens}
      </ReactMarkdown>
    </>
  );
};

export default UiMarkdown;
