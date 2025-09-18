export interface FileSystemTree {
  [name: string]: FileNode;
}

export interface FileNode {
  file?: {
    contents: string;
  };
  directory?: FileSystemTree;
}

export interface SpawnOptions {
  cwd?: string;
  env?: Record<string, string>;
}

export interface WebContainerProcess {
  pid: number;
  output: ReadableStream<string>;
  input: WritableStream<string>;
  kill(): Promise<void>;
  exit: Promise<number>;
}

export interface ContainerInfo {
  id: string;
  status: 'creating' | 'running' | 'stopped' | 'error';
  port?: number;
  previewPort?: number;
  websocketUrl?: string;
  previewUrl?: string;
  createdAt: Date;
}

export interface FileSystemOperation {
  type: 'writeFile' | 'readFile' | 'readdir' | 'mkdir' | 'rm';
  path: string;
  contents?: string;
  options?: any;
}

export interface ProcessOperation {
  type: 'spawn';
  command: string;
  args?: string[];
  options?: SpawnOptions;
}