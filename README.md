# Tripbudgeter

A conversational travel-planning chatbot that quietly keeps your trip
budget up to date in the background. Built for **CPSC 254 Final
Project**.

---

## Run it

> Requires Node 20 LTS (or any Node ≥ 18.17). Tested on macOS.

### 1. Clone the repo

```bash
git clone https://github.com/derricknghe/Final-Project.git
cd Final-Project
```

### 2. Install dependencies

```bash
npm install
```

### 3. Add your OpenAI API key

Create a file called **`.env`** in this folder with exactly one line:

```
OPENAI_API_KEY=sk-your-real-key-here
```

> If you were given a `.env` file, just put it in this folder — that's
> all you need. The app and the eval harness both read `.env`
> automatically. (`.env.local` also works if you prefer.)

### 4. Start the app

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

Example invocation: Try sending a message like: "I want to go to Tokyo for a week — what should I do?" followed by "Hotel is $180 a night for 5 nights".

---

## Run the evaluation

```bash
npm run eval
```

This runs the 10 labeled scenarios in `eval/test_cases.json` against the live OpenAI API and prints something like:

```
accuracy = 10 / 10 = 1.00
```

To reproduce the V1/V2/V3 numbers cited in `REPORT.md`:

```bash
PROMPT_VERSION=v1 npm run eval
PROMPT_VERSION=v2 npm run eval
PROMPT_VERSION=v3 npm run eval
```

---

## Troubleshooting
* **Red error banner in the chat / App crashes on submit:** Your API key is missing or invalid. Check that your `.env` file is in the root folder, not inside `app/` or `src/`, and restart the server.
* **Missing OPENAI_API_KEY during eval:** Same as above. The eval script reads directly from the root environment file.