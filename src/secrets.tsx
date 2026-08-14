import {
  List,
  Icon,
  ActionPanel,
  Action,
  useNavigation,
  showToast,
  Toast,
  Form,
  confirmAlert,
  Color,
  Alert,
  Keyboard,
  showInFinder,
  openExtensionPreferences,
} from "@raycast/api";
import { usePromise, useForm, FormValidation, useCachedState, MutatePromise } from "@raycast/utils";
import { useState } from "react";
import { infisical } from "./infisical";
import { Workspace } from "./types";
import { Folder, Secret } from "@infisical/sdk";
import { OpenInInfisical } from "./components";
import os from "os";
import path from "path";
import { writeFile } from "fs/promises";
import { callInfisicalSdk } from "./authentication";
import { buildSecretPath } from "./secret-path";
import { loadSecretDirectory } from "./secret-directory";
import { joinSecretFolderPath, normalizeSecretFolderPath } from "./secret-folder-path";

type SecretDirectory = { folders: Folder[]; secrets: Secret[] };

async function confirmAndDelete(
  secret: Secret,
  projectId: string,
  environment: string,
  currentPath: string,
  mutateDirectory: MutatePromise<SecretDirectory, undefined>,
) {
  const options: Alert.Options = {
    icon: { source: Icon.Trash, tintColor: Color.Red },
    title: "Do you want to delete this secret?",
    message: "This action is irreversible.",
    primaryAction: {
      style: Alert.ActionStyle.Destructive,
      title: "Delete Secret",
    },
  };
  if (!(await confirmAlert(options))) return;

  const toast = await showToast(Toast.Style.Animated, "Deleting Secret", secret.secretKey);
  try {
    await mutateDirectory(
      callInfisicalSdk(() =>
        infisical.secrets().deleteSecret(secret.secretKey, {
          environment,
          projectId,
          secretPath: currentPath,
        }),
      ),
      {
        optimisticUpdate(data) {
          return {
            folders: data?.folders ?? [],
            secrets: (data?.secrets ?? []).filter((item) => item.id !== secret.id),
          };
        },
        shouldRevalidateAfter: false,
      },
    );
    toast.style = Toast.Style.Success;
    toast.title = "Deleted";
  } catch (error) {
    toast.style = Toast.Style.Failure;
    toast.title = "Failed";
    toast.message = error instanceof Error ? error.message : "Infisical secret request failed.";
  }
}

function combineSecretsAsEnv(secrets: Secret[]) {
  return secrets.map((secret) => `${secret.secretKey}=${secret.secretValue}`).join("\n");
}
async function saveAsEnv(secrets: Secret[], projectName: string, environment: string) {
  const toast = await showToast(Toast.Style.Animated, "Saving");
  const env = combineSecretsAsEnv(secrets);
  try {
    const file = path.join(
      os.homedir(),
      "Downloads",
      `${projectName.replaceAll(" ", "-")}-${Date.now()}.env${environment === "production" ? "" : `.${environment}`}`,
    );
    await writeFile(file, env);
    toast.style = Toast.Style.Success;
    toast.title = "Saved";
    toast.message = file;
    toast.primaryAction = {
      title: "Show in Finder",
      async onAction() {
        await showInFinder(file);
      },
    };
  } catch (error) {
    toast.style = Toast.Style.Failure;
    toast.title = "Failed";
    toast.message = `${error}`;
  }
}

export default function Secrets({
  project,
  secretPath = "/",
  environment: initialEnvironment,
}: {
  project: Workspace;
  secretPath?: string;
  environment?: string;
}) {
  const currentPath = normalizeSecretFolderPath(secretPath);
  const [revealValues, setRevealValues] = useCachedState("reveal-secret-values", false);
  const [environment, setEnvironment] = useState(initialEnvironment ?? project.environments[0].slug);
  const {
    isLoading,
    data: directory = { folders: [], secrets: [] },
    error,
    mutate,
  } = usePromise(() => loadSecretDirectory(project.id, environment, currentPath), [environment, currentPath]);

  const pathTitle = currentPath === "/" ? "Root" : currentPath;

  return (
    <List
      navigationTitle={`Manage Projects / ${project?.name} / Secrets / ${pathTitle}`}
      isLoading={isLoading}
      isShowingDetail
      searchBarAccessory={
        <List.Dropdown tooltip="Environment" value={environment} onChange={setEnvironment}>
          {project.environments.map((environment) => (
            <List.Dropdown.Item key={environment.slug} title={environment.name} value={environment.slug} />
          ))}
        </List.Dropdown>
      }
    >
      {error ? (
        <List.EmptyView
          icon={Icon.ExclamationMark}
          title="Unable to Load Secrets"
          description={error.message}
          actions={
            <ActionPanel>
              <Action icon={Icon.Gear} title="Open Extension Preferences" onAction={openExtensionPreferences} />
            </ActionPanel>
          }
        />
      ) : !isLoading && !directory.folders.length && !directory.secrets.length ? (
        <List.EmptyView
          icon={Icon.Folder}
          description={`${pathTitle} is empty`}
          actions={
            <ActionPanel>
              <Action.Push
                icon={Icon.Plus}
                title="Add Secret"
                target={
                  <AddorEditSecret
                    projectId={project.id}
                    projectName={project.name}
                    environment={environment}
                    secretPath={currentPath}
                  />
                }
                onPop={mutate}
              />
            </ActionPanel>
          }
        />
      ) : (
        <>
          {directory.folders.map((folder) => (
            <List.Item
              key={folder.id}
              icon={Icon.Folder}
              title={folder.name}
              actions={
                <ActionPanel>
                  <Action.Push
                    title="Open Folder"
                    target={
                      <Secrets
                        project={project}
                        secretPath={joinSecretFolderPath(currentPath, folder.name)}
                        environment={environment}
                      />
                    }
                  />
                </ActionPanel>
              }
            />
          ))}
          {directory.secrets.map((secret) => (
            <List.Item
              key={secret.id}
              icon={Icon.Key}
              title={secret.secretKey}
              detail={
                <List.Item.Detail
                  markdown={
                    !secret.secretValue
                      ? "EMPTY"
                      : revealValues
                        ? secret.secretValue
                        : secret.secretValue.replace(/./g, "*")
                  }
                  metadata={
                    <List.Item.Detail.Metadata>
                      {secret.tags.length ? (
                        <List.Item.Detail.Metadata.TagList title="Tags">
                          {secret.tags.map((tag) => (
                            <List.Item.Detail.Metadata.TagList.Item key={tag} text={tag} />
                          ))}
                        </List.Item.Detail.Metadata.TagList>
                      ) : (
                        <List.Item.Detail.Metadata.Label title="Tags" icon={Icon.Minus} />
                      )}
                    </List.Item.Detail.Metadata>
                  }
                />
              }
              actions={
                <ActionPanel>
                  <Action
                    icon={revealValues ? Icon.EyeDisabled : Icon.Eye}
                    title={revealValues ? "Hide Values" : "Reveal Values"}
                    onAction={() => setRevealValues((reveal) => !reveal)}
                  />
                  <Action.CopyToClipboard
                    title="Copy Secret Path"
                    content={buildSecretPath(project.slug, environment, secret.secretPath, secret.secretKey)}
                  />
                  <Action.CopyToClipboard title="Copy Secret" content={secret.secretValue} />
                  <Action.Push
                    icon={Icon.Pencil}
                    title="Edit Secret"
                    target={
                      <AddorEditSecret
                        projectId={project.id}
                        projectName={project.name}
                        environment={environment}
                        secretPath={currentPath}
                        initialSecret={secret}
                      />
                    }
                    onPop={mutate}
                    shortcut={Keyboard.Shortcut.Common.Edit}
                  />
                  <Action
                    icon={Icon.SaveDocument}
                    // eslint-disable-next-line @raycast/prefer-title-case
                    title="Save All as .env"
                    onAction={() => saveAsEnv(directory.secrets, project.name, environment)}
                    shortcut={{ macOS: { modifiers: ["cmd"], key: "s" }, Windows: { modifiers: ["ctrl"], key: "s" } }}
                  />
                  <Action.CopyToClipboard
                    // eslint-disable-next-line @raycast/prefer-title-case
                    title="Copy All as .env"
                    content={combineSecretsAsEnv(directory.secrets)}
                    shortcut={Keyboard.Shortcut.Common.Copy}
                  />
                  <Action
                    icon={Icon.Trash}
                    title="Delete Secret"
                    onAction={() => confirmAndDelete(secret, project.id, environment, currentPath, mutate)}
                    shortcut={Keyboard.Shortcut.Common.Remove}
                    style={Action.Style.Destructive}
                  />
                  <Action.Push
                    icon={Icon.Plus}
                    title="Add Secret"
                    target={
                      <AddorEditSecret
                        projectId={project.id}
                        projectName={project.name}
                        environment={environment}
                        secretPath={currentPath}
                      />
                    }
                    onPop={mutate}
                    shortcut={Keyboard.Shortcut.Common.New}
                  />
                  <OpenInInfisical route={`projects/secret-management/${project.id}/overview`} />
                </ActionPanel>
              }
            />
          ))}
        </>
      )}
    </List>
  );
}

function AddorEditSecret({
  projectId,
  projectName,
  environment,
  secretPath,
  initialSecret,
}: {
  projectId: string;
  projectName: string;
  environment: string;
  secretPath: string;
  initialSecret?: Secret;
}) {
  interface FormValues {
    secretName: string;
    secretValue: string;
  }
  const { pop } = useNavigation();
  const { handleSubmit, itemProps } = useForm<FormValues>({
    async onSubmit(values) {
      const { secretName, secretValue } = values;
      const toast = await showToast(
        Toast.Style.Animated,
        initialSecret ? "Editing" : "Creating",
        initialSecret?.secretKey || secretName,
      );
      try {
        if (initialSecret) {
          await callInfisicalSdk(() =>
            infisical.secrets().updateSecret(initialSecret.secretKey, {
              newSecretName: secretName,
              secretValue,
              projectId,
              environment,
              secretPath,
            }),
          );
        } else {
          await callInfisicalSdk(() =>
            infisical.secrets().createSecret(secretName, {
              secretValue,
              projectId,
              environment,
              secretPath,
            }),
          );
        }
        toast.style = Toast.Style.Success;
        toast.title = initialSecret ? "Edited" : "Created";
        pop();
      } catch (error) {
        toast.style = Toast.Style.Failure;
        toast.title = "Failed";
        toast.message = error instanceof Error ? error.message : "Infisical secret request failed.";
      }
    },
    initialValues: {
      secretName: initialSecret?.secretKey,
      secretValue: initialSecret?.secretValue,
    },
    validation: {
      secretName: FormValidation.Required,
    },
  });
  return (
    <Form
      navigationTitle={`Manage Projects / ${projectName} / Secrets / ${initialSecret ? "Edit" : "Add"}`}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            icon={initialSecret ? Icon.Pencil : Icon.Plus}
            title={initialSecret ? "Edit Secret" : "Create Secret"}
            onSubmit={handleSubmit}
          />
        </ActionPanel>
      }
    >
      <Form.TextField title="Key" placeholder="Type your secret name" {...itemProps.secretName} />
      <Form.PasswordField title="Value" placeholder="EMPTY" {...itemProps.secretValue} />
    </Form>
  );
}
