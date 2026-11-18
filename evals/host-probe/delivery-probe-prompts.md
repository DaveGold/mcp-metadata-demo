# Delivery probe prompts

Paste each into a NEW chat on the host, with only the `deliveryprobe` connector enabled (web search off).
Prompt A first; prompt B in the same chat after A is answered. Score against
`node evals/host-probe/delivery-probe-server.mjs truth`.

## Prompt A: metadata

```text
This is a measurement. Answer only from what is literally in your context; never guess or reconstruct a label. If something is not there, say "not received".

The connector "deliveryprobe" has tools whose descriptions, schemas and server instructions are made of numbered labels like [D8-00256 abc] (a tag, an offset, a 3-letter code). If its tools are not loaded yet, load or search for them first, and tell me whether you had to.

1. probe_desc_8k: quote the FIRST and the LAST label you can see in its description, with their codes, and any truncation marker (such as "…" or "[truncated]") right after the last one.
2. probe_desc_20k: the same.
3. Server instructions of deliveryprobe (labels [I-...]): do you have them? If yes, the first and last label with codes, and any truncation marker.
4. probe_schema_small and probe_schema_large: for each, how many parameters it has, and the label (with code) in the description of its first and last parameter, or "no parameter descriptions".
5. probe_output: do you see an output schema or return type for it? If yes, quote its [O-...] labels.
6. Which product and model are you, as far as your context says?
```

## Prompt B: result channels

```text
Now call each of these deliveryprobe tools once, one at a time, with no arguments: chan_content_only, chan_structured_only, chan_both_divergent, chan_both_divergent_schema, chan_both_json_mirror, chan_both_with_image, chan_both_with_meta, chan_error_with_structured.
After all eight, list for each tool its whole result exactly as you received it (every fingerprint like C_..., S_..., M_..., any image), or "empty". Do not add anything you did not receive.
```
