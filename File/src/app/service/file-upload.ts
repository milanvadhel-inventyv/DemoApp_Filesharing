import { HttpClient, HttpEventType } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { finalize } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class FileUpload {
  private readonly SERVER_URL = 'http://localhost:5000';
  Progress = signal<number>(0);
  private httpclient = inject(HttpClient);

  ShareFile(formdata: any) {
    this.httpclient
      .post(`${this.SERVER_URL}/File-upload`, formdata, {
        reportProgress: true,
        observe: 'events',
      })
      .pipe(
        finalize(() => {
          setTimeout(() => {
            this.Progress.set(0);
          }, 500);
        }),
      )
      .subscribe((event) => {
        switch (event.type) {
          case HttpEventType.UploadProgress:
            if (event.total) {
              const percentage = Math.round((event.loaded / event.total) * 100);
              this.Progress.set(percentage);
            }
            break;
          case HttpEventType.Response:
            this.Progress.set(100);
        }
        console.log('File uploaded');
      });
  }
  UploadChunk(formdata: any) {
    this.httpclient.post(`${this.SERVER_URL}/Chunk-upload`, formdata).subscribe(() => {
      console.log('Chunk uploaded');
    });
  }
  MergeChunks(formdata: any) {
    this.httpclient.post(`${this.SERVER_URL}/Merge-Chunk`, formdata).subscribe(() => {
      console.log('Chunk Merge and File Uploaded..');
    });
  }
  loadOldMessages(room: string) {
    return this.httpclient.get<any[]>(`http://localhost:5000/messages/${room}`);
  }
  download(fileurl: string) {
    this.httpclient
      .get<{ url: string }>(`${this.SERVER_URL}/download?fileurl=${encodeURIComponent(fileurl)}`)
      .subscribe((res) => {
        const link = document.createElement('a');
        link.href = res.url;
        link.click();
      });
  }
}
