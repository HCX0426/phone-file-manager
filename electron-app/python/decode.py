#!/usr/bin/env python3
"""通用加密音乐解密/转码器。基于 libtakiyasha + imageio-ffmpeg。
用法:
  python decode.py --input <ncm/qmc/kgm/vpr/kwm文件> --output <输出mp3> --bitrate 192 [--workdir <目录>]
  python decode.py --transcode-only --input <flac/m4a> --output <out.mp3> --bitrate 192
"""
import argparse
import os
import sys
import subprocess

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# 加密后缀 -> (模块, 打开类 / 构造方法)
SUPPORTED_EXT = ('.ncm', '.mflac', '.mflac0', '.mgg', '.mgg0', '.mgg1',
                 '.qmcflac', '.qmcogg', '.qmc0', '.qmc2', '.qmc3',
                 '.kgm', '.vpr', '.kwm')

# 网易云 NCM 核心密钥（从加密文件提取音频密钥用，网易固定发行）
NCM_CORE_KEY = bytes.fromhex('687A4852416D736F356B496E62617857')


def get_ffmpeg():
    """优先 imageio-ffmpeg 自带二进制，回退系统 ffmpeg。"""
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return 'ffmpeg'


def transcode(ffmpeg, src, dst, bitrate):
    os.makedirs(os.path.dirname(dst) or '.', exist_ok=True)
    r = subprocess.run(
        [ffmpeg, '-y', '-i', src, '-codec:a', 'libmp3lame', '-b:a', str(bitrate) + 'k', dst],
        capture_output=True)
    if r.returncode != 0:
        raise RuntimeError(r.stderr.decode(errors='replace'))
    return dst


def open_cipher(input_path, ext):
    """返回一个可 read() 出解密后音频流的对象。"""
    from libtakiyasha import kgmvpr, kwm, ncm, qmc

    if ext == '.ncm':
        # NCM.open() 需要传入 core_key，read() 返回解密后的原始容器数据(flac/mp3)
        return ncm.NCM.open(input_path, core_key=NCM_CORE_KEY)
    if ext in ('.kgm', '.vpr'):
        return kgmvpr.KGMorVPR.open(input_path)
    if ext == '.kwm':
        return kwm.KWM.open(input_path)
    if ext.startswith('.qmc') or ext in ('.mflac', '.mflac0', '.mgg', '.mgg0', '.mgg1'):
        # QMCv1 失败时自动回退 QMCv2
        try:
            return qmc.QMCv1.open(input_path)
        except Exception:
            return qmc.QMCv2.open(input_path)
    raise RuntimeError(f'不支持的加密格式: {ext}')


def read_all(stream):
    chunks = []
    data = stream.read(1 << 20)
    while data:
        if not data:
            break
        chunks.append(data)
        data = stream.read(1 << 20)
    return b''.join(chunks)


def decode_encrypted(input_path, output_path, bitrate, workdir):
    try:
        import libtakiyasha  # noqa: F401
    except ImportError:
        print("缺少 libtakiyasha，请执行: pip install libtakiyasha imageio-ffmpeg", file=sys.stderr)
        sys.exit(2)

    ext = os.path.splitext(input_path)[1].lower()
    stream = None
    temp_out = None
    try:
        stream = open_cipher(input_path, ext)
        decrypted = read_all(stream)
        if not decrypted:
            raise RuntimeError('解密后数据为空')

        temp_name = os.path.splitext(os.path.basename(input_path))[0] + '.raw'
        temp_out = os.path.join(workdir, temp_name)
        with open(temp_out, 'wb') as f:
            f.write(decrypted)
    except Exception as e:
        print(f"解密失败: {e}", file=sys.stderr)
        sys.exit(6)
    finally:
        if stream is not None:
            try:
                stream.close()
            except Exception:
                pass

    if not temp_out:
        sys.exit(4)

    ffmpeg = get_ffmpeg()
    try:
        transcode(ffmpeg, temp_out, output_path, bitrate)
    except Exception as e:
        print(f"转码失败: {e}", file=sys.stderr)
        sys.exit(5)
    finally:
        if os.path.exists(temp_out):
            try:
                os.remove(temp_out)
            except Exception:
                pass


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--input', required=True)
    ap.add_argument('--output', required=True, help='输出 mp3 路径')
    ap.add_argument('--bitrate', default='192')
    ap.add_argument('--workdir', default='.')
    ap.add_argument('--transcode-only', action='store_true',
                    help='仅用 ffmpeg 转码（普通无损格式转 mp3，不清密）')
    args = ap.parse_args()

    if args.transcode_only:
        ffmpeg = get_ffmpeg()
        try:
            transcode(ffmpeg, args.input, args.output, args.bitrate)
            print("OK")
            sys.exit(0)
        except Exception as e:
            print(f"转码失败: {e}", file=sys.stderr)
            sys.exit(5)

    # 检查输入扩展名，判断加密或普通
    ext = os.path.splitext(args.input)[1].lower()
    if ext in SUPPORTED_EXT:
        decode_encrypted(args.input, args.output, args.bitrate, args.workdir)
    elif ext in ('.flac', '.m4a', '.ogg', '.wav', '.ape', '.wma', '.aac', '.opus'):
        ffmpeg = get_ffmpeg()
        transcode(ffmpeg, args.input, args.output, args.bitrate)
    else:
        print(f"未知/无需处理格式: {ext}", file=sys.stderr)
        sys.exit(3)

    print("OK")


if __name__ == '__main__':
    main()