<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

# nest-rag-system

This repository contains a medical RAG (Retrieval-Augmented Generation) system built with NestJS. It generates personalised, evidence-based doctor commentaries for patients based on their blood test results and health profile, using a local medical knowledge base and large language models.

## What does it do?
- Accepts patient data, current blood test results, and previous results/profile via an API endpoint.
- Compares current and previous results to highlight improvements or deteriorations in biomarkers.
- Analyses changes in the patient's health profile (e.g. weight, exercise, diet, supplements).
- Retrieves relevant medical context from markdown files in the `knowledge_base/` folder.
- Generates a British English doctor commentary, mentioning and explaining changes, and providing actionable advice.

## How does it work?
1. **Knowledge Base:** Medical information is stored in markdown files under `knowledge_base/`. These cover biomarkers, conditions, and lifestyle factors.
2. **API:** The main endpoint `/rag/generate-comment` receives a payload with patient details, current results, previous results, and previous profile.
3. **Comparison Logic:** The service compares current and previous results and profile, detecting and summarising changes.
4. **Retrieval:** Relevant context is retrieved from the knowledge base using vector embeddings.
5. **Generation:** A large language model (Gemini or OpenAI) generates a personalised doctor commentary, following strict medical and stylistic rules.

## How to run
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the server:
   ```bash
   npm run start
   ```
3. The API will be available at `http://localhost:3000` (default).

## Example usage
Send a POST request to `/rag/generate-comment` with a payload like:
```json
{
  "patient": { ... },
  "results": [ ... ],
  "prevData": {
    "results": [ ... ],
    "profile": { ... }
  }
}
```
The response will contain a British English doctor commentary, personalised to the patient's data and changes.

## Project structure
- `src/rag/`: Main RAG logic, service, controller, DTOs
- `knowledge_base/`: Medical markdown files used for context
- `test/`: E2E tests

## Technologies
- NestJS
- LangChain
- ChromaDB
- OpenAI / Gemini LLMs
- class-validator, class-transformer

## License
MIT
