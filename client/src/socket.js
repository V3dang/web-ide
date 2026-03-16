import { io } from 'socket.io-client'

const protocol = window.location.protocol === 'https:' ? 'https' : 'http'
const host = window.location.hostname
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || `${protocol}://${host}:9000`

const socket = io(SOCKET_URL)

export default socket