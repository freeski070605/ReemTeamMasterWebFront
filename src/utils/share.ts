type SharePayload = {
  title?: string;
  text: string;
  url?: string;
};

export const copyTextWithFallback = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();

    try {
      const copied = document.execCommand("copy");
      document.body.removeChild(textarea);
      return copied;
    } catch {
      document.body.removeChild(textarea);
      return false;
    }
  }
};

export const shareOrCopy = async ({ title, text, url }: SharePayload): Promise<"shared" | "copied" | "failed"> => {
  const shareData = { title, text, url };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
      return "shared";
    } catch {
      // Fall through to clipboard when share is cancelled or unavailable at runtime.
    }
  }

  const copied = await copyTextWithFallback([text, url].filter(Boolean).join("\n"));
  return copied ? "copied" : "failed";
};
