import { Action, List } from "@raycast/api";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Workspace } from "./types";

const { loadSecretDirectory, usePromise, useState } = vi.hoisted(() => ({
  loadSecretDirectory: vi.fn(),
  usePromise: vi.fn(),
  useState: vi.fn(),
}));

vi.mock("react", () => ({ useState }));

vi.mock("@raycast/utils", () => ({
  FormValidation: { Required: Symbol("Required") },
  useCachedState: () => [false, vi.fn()],
  useForm: vi.fn(),
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
    PasswordField: component(),
    TextField: component(),
  });
  const List = Object.assign(component(), {
    Dropdown: Object.assign(component(), { Item: component() }),
    EmptyView: component(),
    Item: Object.assign(component(), {
      Detail: Object.assign(component(), {
        Metadata: Object.assign(component(), {
          Label: component(),
          TagList: Object.assign(component(), { Item: component() }),
        }),
      }),
    }),
  });

  return {
    Action,
    ActionPanel: component(),
    Alert: { ActionStyle: { Destructive: "destructive" } },
    Color: { Red: "red" },
    Form,
    Icon: { Folder: "folder" },
    Keyboard: { Shortcut: { Common: {} } },
    List,
    Toast: { Style: {} },
    confirmAlert: vi.fn(),
    openExtensionPreferences: vi.fn(),
    showInFinder: vi.fn(),
    showToast: vi.fn(),
    useNavigation: vi.fn(),
  };
});

vi.mock("./components", () => ({ OpenInInfisical: () => null }));
vi.mock("./authentication", () => ({ callInfisicalSdk: vi.fn() }));
vi.mock("./infisical", () => ({ infisical: {} }));
vi.mock("./secret-directory", () => ({ loadSecretDirectory }));

import Secrets from "./secrets";

function findElement(node: unknown, type: unknown): ReactElement | undefined {
  if (Array.isArray(node)) {
    return node.map((child) => findElement(child, type)).find(Boolean);
  }
  if (!node || typeof node !== "object" || !("props" in node) || !("type" in node)) return undefined;

  const element = node as ReactElement;
  if (element.type === type) return element;
  return Object.values(element.props)
    .map((value) => findElement(value, type))
    .find(Boolean);
}

describe("Secrets folder navigation", () => {
  const project: Workspace = {
    id: "project-1",
    name: "Example",
    slug: "example",
    organization: "organization-1",
    environments: [
      { name: "Development", slug: "dev" },
      { name: "Production", slug: "prod" },
    ],
  };

  beforeEach(() => {
    loadSecretDirectory.mockReset().mockResolvedValue({ folders: [], secrets: [] });
    useState
      .mockReset()
      .mockReturnValueOnce(["prod", vi.fn()])
      .mockImplementation((initialValue) => [initialValue, vi.fn()]);
    usePromise.mockReset().mockImplementation((loader) => {
      void loader();
      return usePromise.mock.calls.length === 1
        ? { data: { folders: [{ id: "folder-1", name: "credentials" }], secrets: [] }, mutate: vi.fn() }
        : { data: { folders: [], secrets: [] }, mutate: vi.fn() };
    });
  });

  it("loads a child folder with the selected non-default environment", () => {
    const root = Secrets({ project });
    const openFolder = findElement(root, Action.Push);
    const child = openFolder?.props.target as ReactElement;

    expect(child).toBeDefined();
    const nestedFolder = child.type(child.props);
    const environmentDropdown = findElement(nestedFolder, List.Dropdown);

    expect(loadSecretDirectory).toHaveBeenLastCalledWith("project-1", "prod", "/credentials");
    expect(child.props.environment).toBe("prod");
    expect(environmentDropdown?.props.value).toBe("prod");
  });
});
