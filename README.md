# @artsy/dismissible

Store dismissible key/value entries in localStorage, which can be used for things like onboarding, notifications and more.

## Setup and Use

```bash
yarn install @artsy/dismissible
```

Once the package is installed, add the `DismissibleProvider` context to your app, pass in localStorage `keys` to be dismissed later, and (optionally) add a `userID` to attach the key identifiers to:

```jsx
const Root = () => {
  return (
    <DismissibleProvider
      keys={["newFeature", "newFeature2"]}
      userID="some-user-id"
    >
      <NewFeatureAlert>
        <NewFeature />
      </NewFeatureAlert>

      <NewFeature2Alert>
        <NewFeature2>
      </NewFeature2Alert>
    </DismissibleProvider>
  )
}
```

Then from `<NewFeatureAlert />`, can manage dismissible keys like so:

```jsx
const NewFeatureAlert = () => {
  const { dismiss, isDismissed } = useDismissibleContext()

  const isDisplayable = !isDismissed("newFeature").status

  const handleClose = () => {
    dismiss(ALERT_ID)
  }

  if (!isDisplayable) {
    return <>{children}</>
  }

  return <Popover message="Check out this new feature!">{children}</Popover>
}
```

## API

The `useDismissibleContext` hook returns a few useful things for managing dismissibles:

```jsx
const App = () => {
  const { dismiss, dismissed, isDismissed, keys, syncFromLoggedOutUser } =
    useDismissibleContext()

  // Dismisses a key
  dismiss("id")

  // All dismissed keys
  dismissed()

  // Status of the thing dismissed, including timestamp
  isDismissied("id")

  // If a logged-out user logs in, resync so that dismissed keys don't reappear
  syncFromLoggedOutUser()

  // All dismissible keys
  console.log(keys)
}
```

## Development

```bash
yarn test
yarn type-check
yarn lint
yarn compile
yarn watch
```

This project uses [auto-release](https://github.com/intuit/auto-release#readme)
to automatically release on every PR. Every PR should have a label that matches
one of the following

- Version: Trivial
- Version: Patch
- Version: Minor
- Version: Major

Major, minor, and patch will cause a new release to be generated. Use major for
breaking changes, minor for new non-breaking features, and patch for bug fixes.
Trivial will not cause a release and should be used when updating documentation
or non-project code.

If you don't want to release on a particular PR but the changes aren't trivial
then use the `Skip Release` tag along side the appropriate version tag.
