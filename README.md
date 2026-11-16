# Nach Yomi - Rabbi Yisrael Motzen

Owner-controlled successor to the original Nach library. Existing audio, timed captions and review notes are retained; the unrelated 13b Gemara shiur is excluded from this library only.

Open: https://ekra1.github.io/nach-yomi/

## Operation

The scheduled workflow reads the public podcast RSS and YouTube metadata. It downloads matching Nach recordings from public podcast enclosures, converts them to AAC, and generates automatic timed captions locally on the standard GitHub runner. No paid transcription API or YouTube authentication cookies are required. Hebrew names and quotations in automatic captions may contain errors.

`maintenance-state.json` records errors and pending reviews. Review points are written from the actual captions/audio by the maintenance assistant; they are not generated from titles or silently marked ready. A missing review stays visibly pending. The workflow alone does not write reviews. The assistant maintenance schedule is established separately.

The old Tab-hosted app and its browser-local progress are not changed. The successor uses its own local listening history. No progress data is sent to the repository.

## Recovery

Pre-takeover main commit: da097ffc204cb9ee10a24af7feb509197283502f. Keep this reference for rollback. Do not restore an old automated updater over the successor without reviewing the maintenance contract.

Source recordings and shiurim belong to Rabbi Yisrael Motzen. Public podcast RSS: https://anchor.fm/s/11165f74/podcast/rss
