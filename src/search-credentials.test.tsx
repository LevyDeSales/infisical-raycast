import { Action, List } from "@raycast/api";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CredentialSearchMatch } from "./credential-search";
import type { Workspace } from "./types";

const {
  listAccessibleWorkspaces,
  searchCredentials,
  copyMatchedSecret,
  useCachedPromise,
  useForm,
  usePromise,
  push,
  clipboardCopy,
  showToast,
} = vi.hoisted(() => ({
  listAccessibleWorkspaces: vi.fn(),
  searchCredentials: vi.fn(),
  copyMatchedSecret: vi.fn(),
  useCachedPromise: vi.fn(),
  useForm: vi.fn(),
  usePromise: vi.fn(),
  push: vi.fn(),
  clipboardCopy: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock("@raycast/utils", () => ({
  FormValidation: { Required: Symbol("Required") },
  useCachedPromise,
  useForm,
  usePromise,
}));

vi.mock("@raycast/api", () => {
  const component = () => () => null;
  const Action = Object.assign(component(), {
    CopyToClipboard: component(),
    Push: component(),
    SubmitForm: component(),
  });
  const Form = Object.assign(component(), {
    Dropdown: Object.assign(component(), { Item: component() }),
    TextField: component(),
  });
  const List = Object.assign(component(), {
    EmptyView: component(),
    Item: component(),
    Section: component(),
  });

  return {
    Action,
    ActionPanel: component(),
    Clipboard: { copy: clipboardCopy },
    Detail: component(),
    Form,
    Icon: { ExclamationMark: "exclamation", Key: "key" },
    List,
    Toast: { Style: { Animated: "animated", Failure: "failure", Success: "success" } },
    getPreferenceValues: () => ({ organizationId: "organization-1" }),
    openExtensionPreferences: vi.fn(),
    showToast,
    useNavigation: () => ({ push }),
  };
});

vi.mock("./credential-search", () => ({
  copyMatchedSecret,
  getDefaultSearchEnvironment: () => "prod",
  getSearchEnvironments: () => [{ name: "Production", slug: "prod" }],
  searchCredentials,
}));

vi.mock("./workspaces", () => ({ listAccessibleWorkspaces }));
vi.mock("./secrets", () => ({ default: () => null }));

import { CredentialSearchForm, CredentialSearchItem, CredentialSearchResults } from "./search-credentials";

type TestElement = ReactElement<Record<string, unknown>>;

function findElement(node: unknown, type: unknown): TestElement | undefined {
  if (Array.isArray(node)) {
    return node.map((child) => findElement(child, type)).find(Boolean);
  }
  if (!node || typeof node !== "object" || !("props" in node) || !("type" in node)) return undefined;

  const element = node as TestElement;
  if (element.type === type) return element;
  return Object.values(element.props)
    .map((value) => findElement(value, type))
    .find(Boolean);
}

const workspace: Workspace = {
  id: "project-1",
  name: "Platform",
  slug: "platform",
  organization: "organization-1",
  environments: [{ name: "Production", slug: "prod" }],
};

const match: CredentialSearchMatch = {
  project: workspace,
  environment: "prod",
  secret: { id: "secret-1", secretKey: "PLUNK_API_KEY", secretPath: "/integrations" },
};

describe("Search Credentials command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useForm.mockImplementation((options) => ({
      handleSubmit: options.onSubmit,
      itemProps: { query: {}, environment: {} },
    }));
    usePromise.mockReturnValue({ data: { matches: [match], failedProjectCount: 0 } });
    showToast.mockResolvedValue({});
  });

  it("does not scan while the search form renders", () => {
    CredentialSearchForm({ workspaces: [workspace], environments: [{ name: "Production", slug: "prod" }] });

    expect(searchCredentials).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("trims a submitted query before pushing the results screen", () => {
    const form = CredentialSearchForm({
      workspaces: [workspace],
      environments: [{ name: "Production", slug: "prod" }],
    });
    const submit = findElement(form, Action.SubmitForm);

    const onSubmit = submit?.props.onSubmit as ((values: { query: string; environment: string }) => void) | undefined;

    onSubmit?.({ query: "  plunk  ", environment: "prod" });

    expect(push).toHaveBeenCalledOnce();
    const results = push.mock.calls[0][0] as TestElement;
    expect(results.props).toMatchObject({ workspaces: [workspace], query: "plunk", environment: "prod" });
  });

  it("rejects a whitespace-only query without pushing results", () => {
    const form = CredentialSearchForm({
      workspaces: [workspace],
      environments: [{ name: "Production", slug: "prod" }],
    });
    const submit = findElement(form, Action.SubmitForm);
    const validation = useForm.mock.calls[0][0].validation.query;

    const onSubmit = submit?.props.onSubmit as ((values: { query: string; environment: string }) => void) | undefined;

    onSubmit?.({ query: "   ", environment: "prod" });

    expect(validation("   ")).toBe("Search query is required.");
    expect(push).not.toHaveBeenCalled();
    expect(searchCredentials).not.toHaveBeenCalled();
  });

  it("renders a metadata-only match with exact folder navigation and path copy", () => {
    const item = CredentialSearchItem({ match });
    const openLocation = findElement(item, Action.Push);
    const copyPath = findElement(item, Action.CopyToClipboard);

    expect(item?.props).toMatchObject({
      title: "PLUNK_API_KEY",
      subtitle: "Platform · /integrations",
      accessories: [{ text: "prod" }],
    });
    const target = openLocation?.props.target as TestElement | undefined;

    expect(target?.props).toMatchObject({
      project: workspace,
      environment: "prod",
      secretPath: "/integrations",
    });
    expect(copyPath?.props).toMatchObject({
      title: "Copy Secret Path",
      content: "/platform/prod/integrations/PLUNK_API_KEY",
    });
    expect(findElement(item, List.Item.Detail)).toBeUndefined();
  });

  it("reports failed project scans even when other matches are available", () => {
    usePromise.mockReturnValue({ data: { matches: [match], failedProjectCount: 1 } });

    const results = CredentialSearchResults({ workspaces: [workspace], query: "plunk", environment: "prod" });
    const warning = findElement(results, List.Section);

    expect(warning?.props).toMatchObject({ title: "Search Results", subtitle: "1 project scan failed" });
  });

  it("retrieves a value only when Copy Secret is explicitly invoked", async () => {
    const item = CredentialSearchItem({ match });
    const copySecret = findElement(item, Action);
    copyMatchedSecret.mockResolvedValue("copied-only-on-action");

    expect(copyMatchedSecret).not.toHaveBeenCalled();
    const onAction = copySecret?.props.onAction as (() => Promise<void>) | undefined;

    await onAction?.();

    expect(copyMatchedSecret).toHaveBeenCalledWith(match);
    expect(clipboardCopy).toHaveBeenCalledWith("copied-only-on-action");
  });
});
