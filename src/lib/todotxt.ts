export interface ParsedTodo {
  id: string; // unique ID for React (not in text)
  raw: string; // the original raw line
  completed: boolean;
  completionDate: string | null;
  priority: string | null;
  creationDate: string | null;
  description: string;
  projects: string[];
  contexts: string[];
  depth: number;
}

export function parseTodo(line: string): ParsedTodo {
  const leadingSpaces = line.match(/^\s*/)?.[0].length || 0;
  const depth = Math.min(5, Math.floor(leadingSpaces / 2));

  let completed = false;
  let completionDate = null;
  let priority = null;
  let creationDate = null;
  let description = line.trim();

  // Rule 1: Completed task
  if (description.startsWith('x ')) {
    completed = true;
    description = description.slice(2).trim();
    
    // Rule 2: Completion date
    const dateMatch = description.match(/^(\d{4}-\d{2}-\d{2})(?:\s+|$)/);
    if (dateMatch) {
      completionDate = dateMatch[1];
      description = description.slice(dateMatch[0].length).trim();
    }
  }

  // Rule 1 (Incomplete): Priority
  const priorityMatch = description.match(/^\(([A-Z])\)(?:\s+|$)/);
  if (priorityMatch) {
    priority = priorityMatch[1];
    description = description.slice(priorityMatch[0].length).trim();
  }

  // Rule 2 (Incomplete): Creation date
  const creationDateMatch = description.match(/^(\d{4}-\d{2}-\d{2})(?:\s+|$)/);
  if (creationDateMatch) {
    creationDate = creationDateMatch[1];
    description = description.slice(creationDateMatch[0].length).trim();
  }

  // Extract projects and contexts
  const projects = Array.from(description.matchAll(/(?:^|\s)\+([^\s]+)/g)).map(m => m[1]);
  const contexts = Array.from(description.matchAll(/(?:^|\s)@([^\s]+)/g)).map(m => m[1]);

  return {
    id: crypto.randomUUID(),
    raw: line,
    completed,
    completionDate,
    priority,
    creationDate,
    description,
    projects,
    contexts,
    depth,
  };
}

export function serializeTodo(item: ParsedTodo): string {
  let line = '  '.repeat(item.depth || 0);
  if (item.completed) {
    line += 'x ';
    if (item.completionDate) {
      line += `${item.completionDate} `;
    }
  }
  if (item.priority) {
    line += `(${item.priority}) `;
  }
  if (item.creationDate) {
    line += `${item.creationDate} `;
  }
  line += item.description;
  return line.trimEnd();
}

export function parseTodoList(content: string): ParsedTodo[] {
  return content.split('\n').filter(line => line.trim().length > 0).map(parseTodo);
}

export function serializeTodoList(todos: ParsedTodo[]): string {
  return todos.map(serializeTodo).join('\n');
}
