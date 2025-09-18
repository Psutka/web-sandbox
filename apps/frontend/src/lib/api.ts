import axios from 'axios'
import { ContainerInfo, FileSystemTree, WebContainerAPI } from '@/types/container.types'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
})

export const containerAPI = {
  async createContainer(files?: FileSystemTree): Promise<ContainerInfo> {
    const response = await api.post('/containers', { files })
    return response.data
  },

  async deleteContainer(id: string): Promise<void> {
    await api.delete(`/containers/${id}`)
  },

  async getContainer(id: string): Promise<ContainerInfo> {
    const response = await api.get(`/containers/${id}`)
    return response.data
  },

  async getAllContainers(): Promise<ContainerInfo[]> {
    const response = await api.get('/containers')
    return response.data
  },
}

export const webContainerAPI: WebContainerAPI = {
  async boot(options?: { files?: FileSystemTree }) {
    const response = await api.post('/webcontainer/boot', options)
    return response.data
  },

  async writeFile(containerId: string, path: string, contents: string) {
    const response = await api.post(`/webcontainer/${containerId}/fs/writeFile`, {
      path,
      contents,
    })
    return response.data
  },

  async readFile(containerId: string, path: string) {
    const response = await api.get(`/webcontainer/${containerId}/fs/readFile/${encodeURIComponent(path)}`)
    return response.data
  },

  async readdir(containerId: string, path: string) {
    const response = await api.get(`/webcontainer/${containerId}/fs/readdir/${encodeURIComponent(path)}`)
    return response.data
  },

  async mkdir(containerId: string, path: string) {
    const response = await api.post(`/webcontainer/${containerId}/fs/mkdir`, { path })
    return response.data
  },

  async rm(containerId: string, path: string) {
    const response = await api.delete(`/webcontainer/${containerId}/fs/rm`, { data: { path } })
    return response.data
  },

  async spawn(containerId: string, command: string, args?: string[]) {
    const response = await api.post(`/webcontainer/${containerId}/spawn`, {
      command,
      args,
    })
    return response.data
  },

  async getUrl(containerId: string) {
    const response = await api.get(`/webcontainer/${containerId}/url`)
    return response.data
  },
}