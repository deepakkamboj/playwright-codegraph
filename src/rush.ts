import fs from 'node:fs';
import path from 'node:path';

import type { RushProject } from './types.js';
import { toPosix } from './utils.js';

export interface RushWorkspace {
  readonly projects: readonly RushProject[];
  projectForFile(file: string): RushProject | undefined;
}

export function loadRushWorkspace(root: string): RushWorkspace {
  const rush = record(readJson(path.join(root, 'rush.json')), 'rush.json');
  const projectValues: unknown = rush.projects;
  if (!Array.isArray(projectValues) || projectValues.length === 0) throw new Error('rush.json must contain projects');
  const base = (projectValues as unknown[]).map((value: unknown) => {
    const entry = record(value, 'Rush project');
    const packageName = text(entry.packageName, 'packageName');
    const projectFolder = text(entry.projectFolder, 'projectFolder');
    return { name: packageName, folder: toPosix(projectFolder) };
  });
  if (new Set(base.map((project) => project.name)).size !== base.length) throw new Error('Rush package names must be unique');
  if (new Set(base.map((project) => project.folder)).size !== base.length) throw new Error('Rush project folders must be unique');
  const names = new Set(base.map((project) => project.name));
  const dependencies = new Map<string, string[]>();
  for (const project of base) {
    const manifest = record(readJson(path.join(root, project.folder, 'package.json')), `${project.name} package.json`);
    const values = new Set<string>();
    for (const section of ['dependencies', 'devDependencies', 'optionalDependencies']) {
      const dependenciesSection = manifest[section];
      if (dependenciesSection && typeof dependenciesSection === 'object') {
        for (const name of Object.keys(dependenciesSection)) if (names.has(name)) values.add(name);
      }
    }
    dependencies.set(project.name, [...values].sort());
  }
  const dependents = new Map(base.map((project) => [project.name, [] as string[]]));
  for (const [project, projectDependencies] of dependencies) {
    for (const dependency of projectDependencies) dependents.get(dependency)?.push(project);
  }
  const projects = base
    .map((project) => ({
      ...project,
      dependencies: dependencies.get(project.name) ?? [],
      dependents: (dependents.get(project.name) ?? []).sort(),
    }))
    .sort((left, right) => left.folder.localeCompare(right.folder));
  const longestFirst = [...projects].sort((left, right) => right.folder.length - left.folder.length);
  return {
    projects,
    projectForFile(file) {
      const normalized = toPosix(file);
      return longestFirst.find((project) => normalized === project.folder || normalized.startsWith(`${project.folder}/`));
    },
  };
}

function readJson(file: string): unknown {
  const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
  return parsed;
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value) throw new Error(`${label} must be a non-empty string`);
  return value;
}
