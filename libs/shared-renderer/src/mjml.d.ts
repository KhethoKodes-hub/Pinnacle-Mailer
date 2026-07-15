declare module 'mjml' {
  export interface MjmlError {
    line?: number;
    message: string;
    formattedMessage?: string;
    tagName?: string;
  }

  export interface MjmlResult {
    html: string;
    errors: MjmlError[];
  }

  export default function mjml2html(
    input: string,
    options?: {
      minify?: boolean;
      validationLevel?: 'strict' | 'soft' | 'skip';
    },
  ): MjmlResult;
}
