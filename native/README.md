# Double Dummy Solver (DDS)

Analiza rozdań korzysta z [dds-bridge/dds](https://github.com/dds-bridge/dds) — natywnej biblioteki C++ na licencji
Apache 2.0. Nie ma jej na NuGet ani w Releases, więc binaria budujemy sami i trzymamy tutaj:

```
native/win-x64/dds.dll        <- development na Windowsie
native/linux-x64/libdds.so    <- obraz kontenera i Azure
```

`Trumpfish.Server.csproj` kopiuje oba pliki do katalogu wyjściowego, jeżeli istnieją. **Nie są wymagane** — bez nich
aplikacja buduje się i działa jak dotąd, a `POST /api/analysis/dds` odpowiada `503` z informacją, że solver jest
niedostępny. Nikt, kto nie tyka analizy rozdań, nie musi niczego budować.

Wersja, przeciw której pisany jest interop: **v3.1.0**. Warstwa `Trumpfish.Server/Services/Dds` używa nowego API
kontekstów (`dds_c_*`) oraz płaskiej funkcji `DealerParBin`; obie są eksportowane przez `//jni:dds_shared` na Windowsie
i na Linuksie.

## Windows — przez GitHub Actions

Bazel na Windowsie **wymaga toolsetu MSVC** (Windows SDK, UCRT, STL), nawet jeżeli kompiluje własnym hermetycznym
clangiem. Visual Studio bez workloadu „Programowanie aplikacji klasycznych w C++" nie wystarczy — build kończy się
`vc_installation_error_x64.bat failed`.

Żeby nie trzymać toolchainu C++ na maszynach deweloperskich, `dds.dll` buduje się na runnerach GitHuba, które mają MSVC
w obrazie:

1. Actions → **Build DDS** → Run workflow, podaj tag (domyślnie `v3.1.0`).
2. Pobierz artefakt `dds-win-x64`.
3. Rozpakuj `dds.dll` do `native/win-x64/dds.dll` i zacommituj.

Ten sam workflow buduje przy okazji `libdds.so` (artefakt `dds-linux-x64`), więc jest alternatywą dla skryptu poniżej.

Gdybyś jednak chciał budować lokalnie: doinstaluj workload C++ do Visual Studio, a potem
`bazelisk build //jni:dds_shared` w klonie repozytorium DDS. Wynik jest w `bazel-bin/jni/dds.dll`. Pierwszy build ściąga
hermetyczny LLVM i trwa kilka minut; cache ląduje poza repozytorium (`C:\_bazel_<user>`) i potrafi urosnąć do kilku GB —
`bazelisk clean --expunge` go czyści.

## Linux — lokalnie w Dockerze

Linux nie ma problemu Windowsa: Bazel buduje tam hermetycznym LLVM-em i nie potrzebuje niczego z systemu. `libdds.so`
musi jedynie być zbudowany pod glibc zgodny z obrazem runtime (`mcr.microsoft.com/dotnet/aspnet:10.0`, Debian 13), więc
buduje się go w kontenerze, a nie na maszynie dewelopera:

```bash
bash native/build-linux.sh
```

Skrypt uruchamia Debiana 13, instaluje bazeliska, buduje `//jni:dds_shared` i zostawia wynik w
`native/linux-x64/libdds.so`. Trwa to kilka minut, ale robi się raz na wersję DDS.

## Dlaczego binaria są w repozytorium

Alternatywą jest osobny stage w `Dockerfile`, który buduje DDS przy każdym budowaniu obrazu. Działa, ale dokłada
bazeliska i toolchain LLVM do każdego builda CI. Skoro binarium zmienia się raz na wydanie DDS, prościej trzymać je
obok kodu — obraz buduje się wtedy dokładnie tak jak dotąd.

## Licencja

DDS jest na Apache License 2.0. Dystrybuując binarium razem z aplikacją, trzymamy obok kopię licencji
(`native/LICENSE-dds.txt`) i informację o pochodzeniu. Przy podbijaniu wersji DDS zaktualizuj tu numer wersji.
