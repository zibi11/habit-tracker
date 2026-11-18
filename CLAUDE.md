# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Single-page habit tracker in plain HTML/CSS/JS: no frameworks, no build step, no dependencies. Keep it that way unless the user asks otherwise.

- `index.html`: markup plus a `<template id="habit-template">` that `app.js` clones for each habit.
- `styles.css`: color tokens on `:root`, overridden in a `prefers-color-scheme: dark` block. Dark mode follows the system only. There is deliberately no manual toggle: one was added and then removed at the user's request.
- `app.js`: all logic, a plain (non-module) script, so its top-level functions are reachable from the browser console for testing.

## Running

Open `index.html` directly, or serve the folder over HTTP. There is no Node or Python on this machine, so the browser pane uses a small PowerShell `HttpListener` server (configured outside the repo). There are no automated tests. Verify in the browser, and exercise `currentStreak` / `longestStreak` / `loadState` from the console.

## Data and logic

- All state is in `localStorage` under `habit-tracker:v1` as `{ habits: [{ id, name, createdAt, done: ["YYYY-MM-DD", ...] }] }`. If the shape ever changes, bump the key and migrate from the old one.
- Dates are **local** `YYYY-MM-DD` strings built by `dateKey()`. Never use `toISOString()`, which is UTC and shifts evening ticks to the wrong day. `parseKey()` parses at noon so DST changes can't move a date.
- `currentStreak` counts back from today, or from yesterday if today isn't ticked yet, so a streak isn't shown as broken before the day ends.
- Data flow: event handler → mutate `state` → `saveState()` → `render()`. `render()` rebuilds the whole list each time. It also re-runs when the date changes (`visibilitychange` plus a 1-minute timer) and on `storage` events from other tabs.
- User text is only ever set with `textContent`. Don't switch to `innerHTML`.
- `storageOk` is set to false only when `localStorage` itself throws. Corrupt JSON just starts fresh.

## Environment

- Windows, PowerShell 5.1.
- If `git` isn't on PATH in the current shell, call it as `& "C:\Program Files\Git\cmd\git.exe"`.
