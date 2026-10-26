# ChatGPT skill import — Hustle

The repository-scoped agent skills live in `.agents/skills/` and are intended for compatible coding agents, including Codex and GitHub Copilot. They **do not automatically synchronize** into the ChatGPT mobile/web skill library.

`ChatGPT/hustle-skill-router/SKILL.md` is a small, Hustle-authored portable companion, not a copy of every third-party skill. It routes ChatGPT toward the audited repository and preserves AED decision authority.

For accounts/workspaces that support personal Skills:
1. Zip the `hustle-skill-router` directory with `SKILL.md` at its root within the folder.
2. In ChatGPT, open Plugins → Skills → Create → Upload from your computer.
3. Upload the ZIP and follow any scan/review or workspace permission prompts.
4. Test with: "For Hustle's Expo app, which repository skill should be consulted before making a navigation change?"

If personal Skills are unavailable on the account, keep using the GitHub integration directly through ChatGPT; the repository source content can be fetched when the connector is accessible. No ChatGPT account installation is implied by merging this PR.

Source: https://help.openai.com/en/articles/20001066-skills-in-chatgpt
