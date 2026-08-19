import {
  Action,
  ActionPanel,
  Clipboard,
  Detail,
  Form,
  getPreferenceValues,
  Icon,
  List,
  openExtensionPreferences,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import { FormValidation, useCachedPromise, useForm, usePromise } from "@raycast/utils";
import {
  copyMatchedSecret,
  getDefaultSearchEnvironment,
  getSearchEnvironments,
  searchCredentials,
  type CredentialSearchMatch,
  type SearchEnvironment,
} from "./credential-search";
import { buildSecretPath } from "./secret-path";
import Secrets from "./secrets";
import type { Workspace } from "./types";
import { listAccessibleWorkspaces } from "./workspaces";

const { organizationId } = getPreferenceValues<Preferences>();

export default function SearchCredentials() {
  const {
    isLoading,
    data: workspaces = [],
    error,
  } = useCachedPromise(() => listAccessibleWorkspaces(organizationId), [], { initialData: [] });

  if (error) {
    return <WorkspaceError error={error} />;
  }

  const environments = getSearchEnvironments(workspaces);

  if (!isLoading && !environments.length) {
    return (
      <Detail
        navigationTitle="Search Credentials"
        markdown="# No Searchable Environments\n\nThe configured access token cannot access a project environment."
      />
    );
  }

  if (isLoading) {
    return <Form isLoading />;
  }

  return <CredentialSearchForm workspaces={workspaces} environments={environments} />;
}

function WorkspaceError({ error }: { error: Error }) {
  return (
    <Detail
      navigationTitle="Search Credentials"
      markdown={`# Unable to Load Projects\n\n\`\`\`${error.message}\`\`\``}
      actions={
        <ActionPanel>
          <Action icon={Icon.Gear} title="Open Extension Preferences" onAction={openExtensionPreferences} />
        </ActionPanel>
      }
    />
  );
}

type CredentialSearchFormProps = {
  workspaces: Workspace[];
  environments: SearchEnvironment[];
};

export function CredentialSearchForm({ workspaces, environments }: CredentialSearchFormProps) {
  const { push } = useNavigation();
  const defaultEnvironment = getDefaultSearchEnvironment(environments) ?? environments[0]?.slug;
  const { handleSubmit, itemProps } = useForm<{ query: string; environment: string }>({
    initialValues: { query: "", environment: defaultEnvironment },
    validation: { query: FormValidation.Required },
    onSubmit(values) {
      const query = values.query.trim();
      if (!query) return;

      push(<CredentialSearchResults workspaces={workspaces} query={query} environment={values.environment} />);
    },
  });

  return (
    <Form
      navigationTitle="Search Credentials"
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Search Credentials" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField title="Search Secret Keys" placeholder="plunk" {...itemProps.query} />
      <Form.Dropdown title="Environment" {...itemProps.environment}>
        {environments.map((environment) => (
          <Form.Dropdown.Item key={environment.slug} title={environment.name} value={environment.slug} />
        ))}
      </Form.Dropdown>
    </Form>
  );
}

type CredentialSearchResultsProps = {
  workspaces: Workspace[];
  query: string;
  environment: string;
};

export function CredentialSearchResults({ workspaces, query, environment }: CredentialSearchResultsProps) {
  const {
    isLoading,
    data: outcome,
    error,
  } = usePromise(
    (selectedWorkspaces: Workspace[], selectedEnvironment: string, selectedQuery: string) =>
      searchCredentials(selectedWorkspaces, selectedEnvironment, selectedQuery),
    [workspaces, environment, query],
  );

  return (
    <List navigationTitle={`Search Credentials / ${query}`} isLoading={isLoading}>
      {error ? (
        <List.EmptyView
          icon={Icon.ExclamationMark}
          title="Unable to Search Credentials"
          description={error.message}
          actions={
            <ActionPanel>
              <Action icon={Icon.Gear} title="Open Extension Preferences" onAction={openExtensionPreferences} />
            </ActionPanel>
          }
        />
      ) : !isLoading && !outcome?.matches.length ? (
        <List.EmptyView
          icon={Icon.Key}
          title="No Matching Secret Keys"
          description={emptySearchDescription(query, environment, outcome?.failedProjectCount ?? 0)}
        />
      ) : (
        outcome?.matches.map((match) => <CredentialSearchItem key={match.secret.id} match={match} />)
      )}
    </List>
  );
}

function emptySearchDescription(query: string, environment: string, failedProjectCount: number) {
  const failureSuffix = failedProjectCount ? ` ${failedProjectCount} project scan(s) failed.` : "";

  return `No accessible secret key matches “${query}” in ${environment}.${failureSuffix}`;
}

export function CredentialSearchItem({ match }: { match: CredentialSearchMatch }) {
  const secretPath = match.secret.secretPath ?? "/";

  return (
    <List.Item
      icon={Icon.Key}
      title={match.secret.secretKey}
      subtitle={`${match.project.name} · ${secretPath}`}
      accessories={[{ text: match.environment }]}
      actions={
        <ActionPanel>
          <Action.Push
            title="Open Secret Location"
            target={<Secrets project={match.project} environment={match.environment} secretPath={secretPath} />}
          />
          <Action.CopyToClipboard
            title="Copy Secret Path"
            content={buildSecretPath(
              match.project.slug,
              match.environment,
              match.secret.secretPath,
              match.secret.secretKey,
            )}
          />
          <Action title="Copy Secret" onAction={() => copySecret(match)} />
        </ActionPanel>
      }
    />
  );
}

async function copySecret(match: CredentialSearchMatch) {
  const toast = await showToast(Toast.Style.Animated, "Copying Secret", match.secret.secretKey);

  try {
    const value = await copyMatchedSecret(match);
    await Clipboard.copy(value);
    toast.style = Toast.Style.Success;
    toast.title = "Copied Secret";
  } catch (error) {
    toast.style = Toast.Style.Failure;
    toast.title = "Failed to Copy Secret";
    toast.message = error instanceof Error ? error.message : "Infisical secret request failed.";
  }
}
