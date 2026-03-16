# Executive Overview

## Product Summary

ESL International Connect is a web app for students studying English in school settings.

It is designed to feel like one continuous intelligent learning companion, not a set of disconnected tools.

Core navigation:
- Home
- Learn
- Speak
- Tools
- Progress

Learn is curriculum-only and shows the student's assigned English curriculum.

Homework Help and Test Prep Sprint live inside `Tools`.

## Core Problem

Students do not have a reliable daily system that:
- aligns practice to what class is covering right now
- helps with homework without giving copyable answers
- gives structured speaking feedback
- measures progress over time with clear reports

## Core Solution

The app combines:
- full diagnostic assessment pre-signup with objective items, writing, and AI conversation
- account creation after the diagnostic to unlock the saved report inside the app
- assessment-based level assignment and promotion (`very_basic`, `basic`, `intermediate`, `advanced`)
- fixed English curricula with sequential units and required activity completion
- personalized curriculum continuation flow in Learn
- urgent one-tap `Homework Help now` path from Home
- a dedicated Tools pillar for Homework Help and Test Prep Sprint
- teacher-authored and placeholder curriculum content as primary learning source
- placeholder content only as temporary bootstrap until teacher content is loaded
- free-talk and guided speaking in Speak
- free-tier text-first Speak with pro voice unlock
- repeatable assessments and saved progress reports in Progress
- visible progress timeline with per-skill trend views for deliberate review
- syllabus-aware recommendation weighting across Home, Learn, and Speak
- test-prep sprint planning for upcoming quizzes/tests

## User Promise

Every session answers:
1. What should I do next?
2. Why is this the next best task?
3. How am I improving?

## Why This Should Work

The architecture intentionally reduces cognitive overhead:
- one dynamic primary action on Home
- one assigned curriculum with one next required activity on Learn
- predictable unit anatomy across the curriculum
- deep progress analysis available when needed, not forced every session

## Business Model (MVP)

Freemium:
- Free: useful daily practice with limits
- Pro: full voice speaking, higher usage limits, deeper reports

Conversion strategy:
- prove value before signup (assessment stepper)
- prove value before upgrade (interrupted-task return after payment)

## MVP Definition

A successful MVP enables a student to:
1. complete assessment and receive a real report
2. start personalized practice quickly
3. get interactive homework help
4. practice speaking and receive actionable feedback
5. generate additional reports over time and compare progress
