# Update Ruby for CocoaPods

## Step 1: Install Homebrew (if not installed)

Run this in your terminal:
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

This will take a few minutes and ask for your password.

## Step 2: Install rbenv (Ruby version manager)

```bash
brew install rbenv ruby-build
```

## Step 3: Add rbenv to your shell

Add this to your `~/.zshrc` file:
```bash
echo 'eval "$(rbenv init - zsh)"' >> ~/.zshrc
source ~/.zshrc
```

## Step 4: Install Ruby 3.2

```bash
rbenv install 3.2.0
rbenv global 3.2.0
```

## Step 5: Verify

```bash
ruby --version
```

You should see Ruby 3.2.0

## Step 6: Install CocoaPods

```bash
gem install cocoapods
```

## Step 7: Build your app

```bash
cd /Users/clarkchung/Desktop/Hoot
npx expo run:ios
```

