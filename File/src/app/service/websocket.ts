import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';

@Injectable({
  providedIn: 'root',
})
export class Websocket {
  private socket!: Socket;
  private readonly SERVER_URL = 'http://localhost:5000';
  private roomUsersSubject = new BehaviorSubject<any[]>([]);
  roomUsers$ = this.roomUsersSubject.asObservable();

  private newMessageSubject = new BehaviorSubject<any | null>(null);
  newMessage$ = this.newMessageSubject.asObservable();
  constructor() {}
  connect(username: string, room: string) {
    this.socket = io(this.SERVER_URL);
    this.socket.on('connect', () => {
      console.log(' Connected:', this.socket.id);

      // join room after connection
      this.socket.emit('room-joined', {
        username,
        room,
      });
    });
    this.socket.on('user-joined', (user) => {
      console.log('user joined', user);
    });
    this.socket.on('new-message', (message) => {
      this.newMessageSubject.next(message);
    });
    this.socket.on('room-users', (user) => {
      this.roomUsersSubject.next(user);
    });
    this.socket.on('disconnect', () => {
      console.log(' Disconnected');
    });
  }
  disconnect() {
    this.socket.disconnect();
  }
}
