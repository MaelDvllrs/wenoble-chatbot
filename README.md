# Wenoble AI Chatbot

**An AI-powered chatbot using Retrieval-Augmented Generation (RAG) to deliver accurate, context-aware answers based on Wenoble's website content.**

The Wenoble AI Chatbot is a conversational assistant designed to help visitors find relevant information about Wenoble's services, expertise, and offerings.

The system retrieves information from the Wenoble website, processes and organizes it into a structured knowledge base, and uses semantic search to provide relevant context to Claude before generating a response.

Rather than relying solely on a language model's general knowledge, the chatbot grounds its answers in retrieved website content.

## Overview

The platform implements a complete RAG pipeline, from website content ingestion to real-time conversational responses.

Website information is collected, transformed into embeddings using Voyage AI, and stored in Supabase with PostgreSQL and pgvector. When a user asks a question, the system searches the knowledge base for relevant information and passes the retrieved context to Anthropic's Claude API to generate a contextual answer.

## Key Features

* **Website Content Ingestion** — Collect and process information from Wenoble's website.
* **Knowledge Base Construction** — Structure and organize website content for efficient retrieval.
* **Semantic Search** — Retrieve relevant information using vector embeddings and similarity search.
* **RAG Pipeline** — Ground AI-generated answers in retrieved website content.
* **Context-Aware Conversations** — Generate responses tailored to users' questions and Wenoble's services.
* **Claude Integration** — Leverage Anthropic's language models for natural language understanding and response generation.
* **Vector Database** — Store and query embeddings using Supabase, PostgreSQL, and pgvector.
* **Embeddings with Voyage AI** — Convert website content into 1024-dimensional vector representations.
* **Embeddable Chat Widget** — Provide a lightweight vanilla JavaScript interface for website visitors.

## Tech Stack

### Backend

| Technology | Purpose                           |
| ---------- | --------------------------------- |
| Fastify 5  | High-performance API server       |
| TypeScript | Type-safe application development |
| Pino       | Structured logging                |
| Zod        | Schema validation                 |

### Database & Retrieval

| Technology | Purpose                              |
| ---------- | ------------------------------------ |
| Supabase   | Database and backend services        |
| PostgreSQL | Persistent data storage              |
| pgvector   | Vector storage and similarity search |
| Voyage AI  | Text embeddings with 1024 dimensions |

### Artificial Intelligence

| Technology           | Purpose                      |
| -------------------- | ---------------------------- |
| Anthropic Claude API | Contextual answer generation |
| `@anthropic-ai/sdk`  | Claude API integration       |

### Admin Interface & Widget

| Technology         | Purpose                              |
| ------------------ | ------------------------------------ |
| Next.js 15         | Admin interface using the App Router |
| Tailwind CSS 4     | Admin interface styling              |
| Vanilla JavaScript | Lightweight embeddable chat widget   |

## How It Works

The chatbot relies on a Retrieval-Augmented Generation architecture that connects Wenoble's website content to an AI-powered conversational interface.

### 1. Content Ingestion

Information from the Wenoble website is collected and processed to create a knowledge base containing relevant information about the company, its services, and its expertise.

### 2. Embedding Generation

The content is organized into suitable text segments and converted into vector embeddings using Voyage AI. Each embedding represents semantic information in a 1024-dimensional vector space.

### 3. Knowledge Storage

The processed content and its embeddings are stored in Supabase using PostgreSQL and pgvector, making the knowledge base searchable through vector similarity.

### 4. Semantic Retrieval

When a visitor submits a question, the system searches the knowledge base to retrieve content semantically relevant to the query.

### 5. Contextual Answer Generation

The retrieved information is passed to Anthropic's Claude API as context. Claude uses this information to generate a natural language response grounded in Wenoble's website content.

### 6. Response Delivery

The generated answer is returned to the chat widget, providing visitors with a conversational way to explore Wenoble's services and find relevant information.

## Architecture

The application is built around three main components:

* **Ingestion & Retrieval Backend** — A TypeScript API powered by Fastify, responsible for processing requests and coordinating the RAG pipeline.
* **Knowledge Layer** — Supabase, PostgreSQL, and pgvector for storing website content and retrieving semantically relevant information.
* **User Interfaces** — A Next.js administration interface and a lightweight vanilla JavaScript chat widget.

Voyage AI handles embedding generation, while Anthropic's Claude API powers response generation.

## Technical Highlights

* End-to-end Retrieval-Augmented Generation pipeline.
* Semantic retrieval using vector embeddings and pgvector.
* Integration of specialized AI services for embeddings and language generation.
* Structured data validation with Zod.
* Type-safe backend architecture with TypeScript.
* High-performance API built with Fastify 5.
* Lightweight, embeddable frontend widget without a heavy JavaScript framework.

## Project Goal

The goal is to make Wenoble's website content accessible through a conversational interface, helping visitors find relevant information more naturally than through traditional website navigation.

The project demonstrates how RAG architecture can transform existing website content into a searchable knowledge base and power an AI assistant grounded in a company's own information.

---

**Built with Fastify, TypeScript, Supabase, PostgreSQL, pgvector, Voyage AI, Anthropic Claude, Next.js, and vanilla JavaScript.**
