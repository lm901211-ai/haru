/** 웹에서 파일 선택 창을 띄워 고른 파일들을 돌려줌 (취소하면 빈 배열) */
export function chooseFiles({ accept, multiple = false }: { accept: string; multiple?: boolean }): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    let settled = false;
    const finish = (files: File[]) => {
      if (settled) return;
      settled = true;
      resolve(files);
    };
    input.addEventListener('change', () => finish(Array.from(input.files ?? [])));
    // 선택을 취소한 경우 (지원하는 브라우저)
    input.addEventListener('cancel', () => finish([]));
    // cancel 이벤트가 없는 브라우저: 창으로 돌아온 뒤에도 파일이 없으면 취소로 봄
    window.addEventListener(
      'focus',
      () =>
        setTimeout(() => {
          if (!input.files?.length) finish([]);
        }, 1500),
      { once: true },
    );
    input.click();
  });
}
