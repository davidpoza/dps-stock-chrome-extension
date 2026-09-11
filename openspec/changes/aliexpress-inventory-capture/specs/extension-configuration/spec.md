## ADDED Requirements

### Requirement: Store backend connection settings
The extension SHALL provide an options page where the user can enter and persist the DPS Stock backend base URL and an API key. Settings SHALL be stored in extension storage (not in the visited page) and SHALL persist across browser restarts.

#### Scenario: Save settings
- **WHEN** the user enters a backend base URL and an API key on the options page and clicks Save
- **THEN** the values are written to extension storage and remain available after the browser is restarted

#### Scenario: Reject empty required settings
- **WHEN** the user attempts to save with an empty backend URL or empty API key
- **THEN** the extension does not save and shows a validation message identifying the missing field

### Requirement: Validate the backend connection
The extension SHALL let the user verify the configured backend URL and API key before use, by performing an authenticated request and reporting the result.

#### Scenario: Valid credentials
- **WHEN** the user clicks "Test connection" with a reachable backend and a valid API key
- **THEN** the extension reports success

#### Scenario: Invalid credentials
- **WHEN** the user clicks "Test connection" with an unreachable backend or an invalid API key
- **THEN** the extension reports a failure with a message distinguishing an unreachable backend from a rejected key (HTTP 401/403)

### Requirement: Select default item templates
The extension SHALL allow the user to choose a default Tool template and an optional default Part template from the templates available in the backend, so created items are typed correctly. The Tool template offered MUST be one that enables the `TOOL` capability.

#### Scenario: Load templates from backend
- **WHEN** the options page opens with valid settings
- **THEN** the extension fetches the list of item templates and presents the tool-capable templates for the Tool default selection

#### Scenario: Persist template choice
- **WHEN** the user selects a default Tool template (and optionally a Part template) and saves
- **THEN** the choices are persisted and used when creating items

### Requirement: Protect credentials from the visited page
The API key SHALL only be readable by the extension's own contexts (service worker / options page) and SHALL never be injected into or made readable by the AliExpress page's JavaScript context.

#### Scenario: Content script has no direct key access
- **WHEN** the content script needs an authenticated backend call
- **THEN** it delegates the call to the background service worker and never receives the raw API key
