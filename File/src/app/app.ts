import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Websocket } from './service/websocket';
import { FileUpload } from './service/file-upload';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-root',
  imports: [FormsModule, DatePipe],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  RoomConnected = signal<boolean>(false);
  username: string = '';
  room: string = '';
  messages = signal<any[]>([]);
  RoomUsers = signal<any[]>([]);
  websocket = inject(Websocket);
  fileupload = inject(FileUpload);
  progress = this.fileupload.Progress;
  file: File | null = null;
  constructor() {
    // this.websocket.connect(this.username, this.room);
    console.log('App.compotent.ts');
  }
  ngOnInit() {
    this.websocket.roomUsers$.subscribe((users) => {
      this.RoomUsers.set(users);
    });

    // subscribe new messages
    this.websocket.newMessage$.subscribe((message) => {
      if (message) {
        this.messages.update((prev) => [...prev, message]);
      }
    });
  }
  Connect() {
    this.fileupload.loadOldMessages(this.room).subscribe((data) => {
      this.messages.set(data);
    });
    this.websocket.connect(this.username, this.room);
    this.RoomConnected.set(true);

    console.log('Room Connection', this.username, this.room);
  }

  Disconnect() {
    this.websocket.disconnect();
    this.RoomConnected.set(false);
  }

  fileStore(event: any) {
    this.file = event.target.files[0];
  }
  fileUpload() {
    if (!this.file) {
      return;
    }
    const one_mb = 1024 * 1024;
    if (this.file.size >= one_mb) {
      this.fileUploadViaChunks(this.file);
      return;
    }

    const formdata = new FormData();
    formdata.append('file', this.file);
    formdata.append('username', this.username);
    formdata.append('room', this.room);
    this.fileupload.ShareFile(formdata);
    console.log('File upload directly');
  }
  async fileUploadViaChunks(file: File) {
    const chunkSize = 16 * 1024;
    const totalChunks = Math.ceil(file.size / chunkSize);
    const uploadId = crypto.randomUUID();

    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      const chunk = file.slice(start, end);

      const formdata = new FormData();
      formdata.append('uploadId', uploadId);
      formdata.append('chunk', chunk);
      formdata.append('chunkIndex', i.toString());

      this.fileupload.UploadChunk(formdata);

      // this.progress.set(Math.round(((i + 1) / totalChunks) * 100));
    }

    this.fileupload.MergeChunks({
      uploadId,
      totalChunks,
      filename: file.name,
      mimetype: file.type,
      username: this.username,
      room: this.room,
    });

    // this.progress.set(100);
  }
  downloadfile(fileurl: string) {
    this.fileupload.download(fileurl);
  }
}
