interface FunctionErrorContext {
  json?: () => Promise<{ error?: string; message?: string }>;
}

interface FunctionInvokeError {
  message: string;
  context?: FunctionErrorContext;
}

export async function parseFunctionInvokeError(error: FunctionInvokeError): Promise<string> {
  if (error.context?.json) {
    try {
      const body = await error.context.json();
      if (body.error) return String(body.error);
      if (body.message) return String(body.message);
    } catch {
      /* use default message */
    }
  }
  return error.message;
}
