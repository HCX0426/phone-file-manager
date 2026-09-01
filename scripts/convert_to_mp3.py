# 将网易云 .ncm（及 .flac）批量转成 mp3
# 依赖: 已安装的 Python venv (含 ncmdump, imageio-ffmpeg)。见 setup_venv.ps1 / README
# 用法: python convert_to_mp3.py -i <输入目录> -o <输出目录>
import os, sys, subprocess, argparse, shutil
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('-i', '--input', required=True, help='输入目录(含 .ncm/.flac/.mp3)')
    ap.add_argument('-o', '--output', default='./mp3_out', help='输出目录')
    args = ap.parse_args()

    src = os.path.abspath(args.input)
    out = os.path.abspath(args.output)
    os.makedirs(out, exist_ok=True)

    try:
        from ncmdump import dump
    except ImportError:
        print("缺少 ncmdump，请先: pip install ncmdump")
        sys.exit(1)

    try:
        import imageio_ffmpeg
        FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        FFMPEG = None

    files = [f for f in os.listdir(src) if os.path.isfile(os.path.join(src, f))]
    ncm = [f for f in files if f.lower().endswith('.ncm')]
    flac = [f for f in files if f.lower().endswith('.flac')]
    mp3 = [f for f in files if f.lower().endswith('.mp3')]

    print(f"发现 ncm={len(ncm)} flac={len(flac)} mp3={len(mp3)}")

    staged = {}   # 友好名 -> 产出 mp3 路径

    def friendly(name):
        # 保留原文件名做基础(去掉扩展名)，避免乱码命名风险
        base = os.path.splitext(name)[0]
        return base.strip()

    # 1) ncm -> 原始格式(mp3或flac)
    for f in ncm:
        print(f"[ncm] {f}")
        try:
            outp = dump(os.path.join(src, f))  # None -> 生成到源目录
            base = os.path.basename(outp)
            staged.setdefault(friendly(f), outp)
            print(f"  -> {base} ({os.path.splitext(outp)[1]})")
        except Exception as e:
            print(f"  ERROR: {e}")

    # 2) 已有的 mp3 / flac 也纳入
    for f in mp3:
        staged.setdefault(friendly(f), os.path.join(src, f))
    for f in flac:
        staged.setdefault(friendly(f), os.path.join(src, f))

    # 3) 统一转成 / 收集 mp3
    final = []
    for name, path in staged.items():
        ext = os.path.splitext(path)[1].lower()
        dst = os.path.join(out, name + '.mp3')
        if ext == '.mp3':
            if os.path.abspath(path) != os.path.abspath(dst):
                shutil.copy2(path, dst)
            final.append(dst)
            print(f"[mp3 ] {name}.mp3")
        elif ext == '.flac':
            if FFMPEG is None:
                print(f"[flac] 跳过(无ffmpeg): {name}.flac")
                continue
            print(f"[flac->mp3] {name}.flac")
            r = subprocess.run(
                [FFMPEG, '-y', '-i', path, '-codec:a', 'libmp3lame', '-b:a', '192k', dst],
                capture_output=True)
            if r.returncode == 0 and os.path.exists(dst):
                final.append(dst)
                print(f"  -> {name}.mp3")
            else:
                print(f"  ERROR rc={r.returncode}")
        else:
            print(f"[skip] 未知格式: {path}")

    print(f"\n完成，共 {len(final)} 个 mp3 输出到 {out}")

if __name__ == '__main__':
    main()
