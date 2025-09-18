export interface ContainerInfo {
  id: string
  status: 'creating' | 'running' | 'stopped' | 'error'
  port?: number
  websocketUrl?: string
  createdAt: Date
}

export interface FileSystemTree {
  [name: string]: FileNode
}

export interface FileNode {
  file?: {
    contents: string
  }
  directory?: FileSystemTree
}

export interface WebContainerAPI {
  boot(options?: { files?: FileSystemTree }): Promise<{ containerId: string; url: string; status: string }>
  writeFile(containerId: string, path: string, contents: string): Promise<any>
  readFile(containerId: string, path: string): Promise<{ contents: string }>
  readdir(containerId: string, path: string): Promise<{ files: any[] }>
  mkdir(containerId: string, path: string): Promise<any>
  rm(containerId: string, path: string): Promise<any>
  spawn(containerId: string, command: string, args?: string[]): Promise<any>
  getUrl(containerId: string): Promise<{ url: string }>
}